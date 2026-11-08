import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Form, Link } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import NativeSelect from "@mui/material/NativeSelect";
import OutlinedInput from "@mui/material/OutlinedInput";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import InboxOutlined from "@mui/icons-material/InboxOutlined";

export { default as DataTable } from "@mui/material/Table";
export { default as TableHead } from "@mui/material/TableHead";
export { default as TableBody } from "@mui/material/TableBody";
export { default as TableRow } from "@mui/material/TableRow";
export { default as TableCell } from "@mui/material/TableCell";
export { default as TableContainer } from "@mui/material/TableContainer";

export function ActionLink(props: Omit<ComponentProps<typeof Link>, "color">) {
  return <Button component={Link} variant="contained" {...props} />;
}

// These adapters keep the existing HTML form contract, including submitter
// name/value, native constraints, and controls nested in a disabled fieldset.
export function ActionButton({ className, type = "submit", ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">) {
  const secondary = /academic-secondary|text-button|portal-logout/.test(className ?? "");
  return <Button {...props} type={type} className={className} variant={secondary ? "outlined" : "contained"} />;
}

export function InputControl(props: InputHTMLAttributes<HTMLInputElement>) {
  const { type = "text", className, size: _size, color: _color, value, defaultValue, onChange, disabled, required, readOnly, name, id, autoFocus, ...inputProps } = props;
  if (type === "hidden") return <input {...props} />;
  if (type === "checkbox" || type === "radio") {
    const Control = type === "checkbox" ? Checkbox : Radio;
    return <Control size="small" className={className} name={name} id={id} value={value}
      checked={props.checked} defaultChecked={props.defaultChecked} onChange={onChange}
      disabled={disabled} required={required} autoFocus={autoFocus} slotProps={{ input: inputProps }} />;
  }
  return <OutlinedInput className={className} type={type} value={value} defaultValue={defaultValue}
    onChange={onChange} disabled={disabled} required={required} readOnly={readOnly}
    name={name} id={id} autoFocus={autoFocus} inputProps={inputProps} fullWidth />;
}

export function SelectControl({ className, value, defaultValue, onChange, disabled, required, name, id, children, ...inputProps }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <NativeSelect className={className} value={value} defaultValue={defaultValue} onChange={onChange}
    disabled={disabled} required={required} name={name} id={id} inputProps={inputProps}
    input={<OutlinedInput notched={false} />} variant="outlined" fullWidth>{children}</NativeSelect>;
}

export function TextareaControl({ className, value, defaultValue, onChange, disabled, required, name, id, rows = 3, ...inputProps }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <OutlinedInput className={className} value={value} defaultValue={defaultValue} onChange={onChange}
    disabled={disabled} required={required} name={name} id={id} rows={rows} inputProps={inputProps} multiline fullWidth />;
}

export function FilterForm(props: ComponentProps<typeof Form>) {
  return <Paper component={Form} variant="outlined" {...props} />;
}

export function FormPanel(props: ComponentProps<typeof Form>) {
  return <Paper component={Form} variant="outlined" {...props} />;
}

export function PageHeading({ title, description, context, actions, ...props }: Omit<HTMLAttributes<HTMLElement>, "title" | "children"> & {
  title: string;
  description?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return <Box component="header" {...props} className={`page-heading ${props.className ?? ""}`}>
    <div>{context ? <div className="page-context">{context}</div> : null}<h1>{title}</h1>{description ? <p className="page-description">{description}</p> : null}</div>{actions}
  </Box>;
}

export function StatusMessage({ className, role, children, severity, ...props }: Omit<HTMLAttributes<HTMLDivElement>, "color"> & {
  severity?: "success" | "info" | "warning" | "error";
}) {
  const tone = severity ?? (role === "alert" || /error/.test(className ?? "") ? "error" : /notice/.test(className ?? "") ? "success" : "info");
  return <Alert {...props} className={className} severity={tone} role={role ?? "status"}>{children}</Alert>;
}

export function EmptyState({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Paper variant="outlined" {...props} className={`empty-state ${className ?? ""}`}>
    <InboxOutlined aria-hidden="true" sx={{ fontSize: 30, color: "text.secondary", mb: 1 }} />
    <div>{children}</div>
  </Paper>;
}

export function StatusChip({ label }: { label: string }) {
  const color = ["已選", "可加選", "已核准", "已公布", "出席"].includes(label) ? "success"
    : ["時段衝突", "額滿", "已駁回", "已停修", "缺課", "遲到"].includes(label) ? "warning"
    : label === "待審核" ? "info" : "default";
  return <Chip label={label} color={color} variant="outlined" />;
}
