import { notFound } from 'next/navigation';
import { AdminManagement } from '@/components/identity/admin-management';
import type { Resource } from '@/components/identity/api';
export default async function AdminPage({params}:{params:Promise<{resource:string}>}){const {resource}=await params;if(!['users','batches','laboratories'].includes(resource))notFound();return <AdminManagement resource={resource as Resource}/>;}
