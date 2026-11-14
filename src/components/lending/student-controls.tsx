'use client';
import { Children, isValidElement, type ReactNode, type ComponentProps } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
type Props = {
  value?: string | number;
  defaultValue?: string | number;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  children: ReactNode;
  onChange?: (event: { target: { value: string } }) => void;
  'aria-describedby'?: string;
};
/** Application composition of official Radix Select; empty domain values use a private UI sentinel. */
export function StudentSelect({
  children,
  value,
  defaultValue,
  onChange,
  className,
  ...props
}: Props) {
  const options = Children.toArray(children).filter(
    isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>
  );
  const sentinel = '__student_all__';
  return (
    <Select
      name={props.name}
      required={props.required}
      disabled={props.disabled}
      value={value === undefined ? undefined : String(value) || sentinel}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue) || sentinel}
      onValueChange={(next) => onChange?.({ target: { value: next === sentinel ? '' : next } })}
    >
      <SelectTrigger className={className} aria-describedby={props['aria-describedby']}>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option, i) => {
          const text = option.props.children;
          const key = String(
            option.props.value ?? (typeof text === 'string' || typeof text === 'number' ? text : i)
          );
          return (
            <SelectItem
              key={key || sentinel}
              value={key || sentinel}
              disabled={option.props.disabled}
            >
              {text}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
export function NativeSelect(props: Props) {
  return <select {...props} onChange={props.onChange as ComponentProps<'select'>['onChange']} />;
}
