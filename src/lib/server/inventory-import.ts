import readXlsxFile from 'read-excel-file/node';
import {Open} from 'unzipper-esm';
import {zipSync} from 'fflate';
let parsing=false;
const columns=['itemId','labId','locationId','quantity','provenance'];
const workbookParts=new Set(['[Content_Types].xml','_rels/.rels','docProps/core.xml','docProps/app.xml','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/worksheets/sheet1.xml','xl/styles.xml','xl/sharedStrings.xml','xl/theme/theme1.xml']);
const contentTypes=new Set(['application/xml','application/vnd.openxmlformats-package.relationships+xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml','application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml','application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml','application/vnd.openxmlformats-officedocument.theme+xml','application/vnd.openxmlformats-package.core-properties+xml','application/vnd.openxmlformats-officedocument.extended-properties+xml']);
function workbookXml(value:Buffer,path:string):string{
 if(value.includes(0)||(value[0]===0xff&&value[1]===0xfe)||(value[0]===0xfe&&value[1]===0xff))throw Error('XML_ENCODING');
 let xml:string;try{xml=new TextDecoder('utf-8',{fatal:true}).decode(value);}catch{throw Error('XML_ENCODING');}
 const declaration=xml.match(/^\s*<\?xml\b[^?]*\?>/i)?.[0];
 if(declaration){const encoding=declaration.match(/\bencoding\s*=\s*["']([^"']+)["']/i)?.[1];if(encoding&&encoding.toLowerCase()!=='utf-8')throw Error('XML_ENCODING');}
 if(/\bencoding\s*=\s*["'](?:utf-16|utf-32|iso-8859|windows-)/i.test(xml))throw Error('XML_ENCODING');
 if(path==='[Content_Types].xml'){
 if(xml.includes('&'))throw Error('UNSUPPORTED_PART');
 for(const match of xml.matchAll(/<(?:\w+:)?(?:Default|Override)\b[^>]*>/g)){
 const type=match[0].match(/\bContentType\s*=\s*["']([^"']+)["']/)?.[1];
 const part=match[0].match(/\bPartName\s*=\s*["']([^"']+)["']/)?.[1];
 const extension=match[0].match(/\bExtension\s*=\s*["']([^"']+)["']/)?.[1];
 if(!type||!contentTypes.has(type)||(part&&!workbookParts.has(part.replace(/^\//,'')))||(extension&&!['xml','rels'].includes(extension)))throw Error('UNSUPPORTED_PART');
 }
 }
 if(path.endsWith('.rels')){
 const targets=path==='_rels/.rels'?['xl/workbook.xml','docProps/core.xml','docProps/app.xml']:['worksheets/sheet1.xml','styles.xml','sharedStrings.xml','theme/theme1.xml','/xl/worksheets/sheet1.xml','/xl/styles.xml','/xl/sharedStrings.xml','/xl/theme/theme1.xml'];
 for(const match of xml.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)){
 const target=match[0].match(/\bTarget\s*=\s*["']([^"']+)["']/)?.[1];
 const type=match[0].match(/\bType\s*=\s*["']([^"']+)["']/)?.[1];
 if(!target||!targets.includes(target)||!type||!['http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument','http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet','http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles','http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings','http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme','http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties','http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties'].includes(type))throw Error('UNSUPPORTED_PART');
 }
 }
 return xml;
}
export type ImportIssue={row:number;column:string;code:string};
export class ImportValidationError extends Error{errors:ImportIssue[];constructor(errors:ImportIssue[]){super('VALIDATION_FAILED');this.errors=errors;}}
export function importIssues(error:unknown):ImportIssue[]{
 if(error instanceof ImportValidationError)return error.errors;
 const safe=['CSV','IMPORT_LIMIT','IMPORT_BUSY','BASE64','ZIP_LIMIT','ZIP_PATH','XML_ENCODING','UNSUPPORTED_PART','UNSUPPORTED_XML','REMOTE_RELATIONSHIP','SHEET_LIMIT','ONE_SHEET_REQUIRED','HEADERS_OR_ROWS','FORMAT'];
 return [{row:error instanceof Error&&error.message==='HEADERS_OR_ROWS'?1:0,column:'file',code:error instanceof Error&&safe.includes(error.message)?error.message:'INVALID_FILE'}];
}
function csv(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];
 if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
 else if(c==='"'){if(cell||closed)throw Error('CSV');quoted=true;}
 else if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];}}
 else{if(closed)throw Error('CSV');cell+=c;}
 if(cell.length>300||row.length>5||rows.length>101)throw Error('IMPORT_LIMIT');
 }
 if(quoted)throw Error('CSV');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export async function importRows(format:unknown,content:unknown){
 if(parsing)throw Error('IMPORT_BUSY');parsing=true;
 try{
 if(typeof content!=='string'||content.length>700000)throw Error('IMPORT_LIMIT');
 let rows:unknown[][];
 if(format==='CSV'){rows=csv(content.replace(/^\uFEFF/,''));}
 else if(format==='XLSX'){
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(content))throw Error('BASE64');
 const data=Buffer.from(content,'base64');if(data.length>512000)throw Error('IMPORT_LIMIT');
 const directory=await Open.buffer(data);if(directory.files.length>32)throw Error('ZIP_LIMIT');
 const safe:Record<string,Uint8Array>={};let total=0;
 for(const entry of directory.files){
 if(entry.type==='Directory')continue;
 if(!workbookParts.has(entry.path))throw Error('UNSUPPORTED_PART');
 if(entry.path.includes('..')||entry.path.startsWith('/')||safe[entry.path]||!(/^[A-Za-z0-9_./\[\]-]+$/).test(entry.path))throw Error('ZIP_PATH');
 const chunks:Buffer[]=[];let size=0;
 const stream=entry.stream();
 for await(const chunk of stream){size+=chunk.length;total+=chunk.length;if(size>1000000||total>2000000){stream.destroy();throw Error('ZIP_LIMIT');}chunks.push(chunk);}
 const value=Buffer.concat(chunks);
 // Decode fatally before every policy scan; inspect relationships only after remote-target scan below.
 const xml=workbookXml(value,entry.path.endsWith('.rels')?'':entry.path);if(/<!DOCTYPE|<!ENTITY|<(?:\w+:)?f[\s/>]/i.test(xml))throw Error('UNSUPPORTED_XML');
 if(/\bTargetMode\s*=\s*["']External["']/i.test(xml)||/\b(?:Target|href|src)\s*=\s*["'](?:[a-z][a-z0-9+.-]*:|\/\/|\\\\)/i.test(xml)||(entry.path.endsWith('.rels')&&xml.includes('&')))throw Error('REMOTE_RELATIONSHIP');
 if(entry.path.endsWith('.rels'))workbookXml(value,entry.path);
 if(entry.path.startsWith('xl/worksheets/')){
 if((xml.match(/<(?:\w+:)?c\b/g)??[]).length>505||(xml.match(/<(?:\w+:)?row\b/g)??[]).length>101)throw Error('SHEET_LIMIT');
 for(const match of xml.matchAll(/(?:r|ref)\s*=\s*["']([^"']+)["']/g)){
 for(const coordinate of match[1].split(':')){const m=/^([A-E]?)([1-9][0-9]*)$/.exec(coordinate);if(!m||Number(m[2])>101)throw Error('SHEET_LIMIT');}
 }
 }
 safe[entry.path]=value;
 }
 const sheets=await readXlsxFile(Buffer.from(zipSync(safe)));if(sheets.length!==1)throw Error('ONE_SHEET_REQUIRED');rows=sheets[0].data;
 }else throw Error('FORMAT');
 if(rows.length<2||rows.length>101||JSON.stringify(rows[0])!==JSON.stringify(columns))throw Error('HEADERS_OR_ROWS');
 const errors:ImportIssue[]=[];
 const output=rows.slice(1).map((row,index)=>{
 if(row.length>5)errors.push({row:index+2,column:'row',code:'EXTRA_COLUMN'});
 columns.forEach((column,i)=>{const value=row[i];if(value===null||value===undefined||typeof value==='object'||String(value).length>300)errors.push({row:index+2,column,code:'INVALID_CELL'});});
 const [itemId,labId,locationId,raw,provenance]=row;
 if(!/^[1-9][0-9]*$/.test(String(raw))||Number(raw)>1000000)errors.push({row:index+2,column:'quantity',code:'POSITIVE_INTEGER_REQUIRED'});
 return {itemId,labId,locationId,quantity:Number(raw),provenance};
 });
 if(errors.length)throw new ImportValidationError(errors);
 return output;
 }finally{parsing=false;}
}

