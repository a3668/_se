import { createTheme } from "@mui/material/styles";
import { zhTW } from "@mui/material/locale";

export const theme = createTheme({
  breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1000, xl: 1440 } },
  palette: {
    mode: "light",
    primary: { main: "#234e83", dark: "#17375f", light: "#eaf1fb" },
    secondary: { main: "#52677f" },
    background: { default: "#f4f6fa", paper: "#ffffff" },
    text: { primary: "#202f43", secondary: "#66768b" },
    divider: "#e2e8f0",
    success: { main: "#26745b" },
    warning: { main: "#956310" },
    error: { main: "#b23d47" },
  },
  typography: {
    fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
    fontSize: 14,
    h1: { fontSize: "1.75rem", fontWeight: 750, lineHeight: 1.4 },
    h2: { fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.5 },
    h3: { fontSize: "1rem", fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 650 },
    body1: { fontSize: "0.875rem", lineHeight: 1.7 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.65 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { size: "small", disableElevation: true },
      styleOverrides: { root: { minHeight: 36, paddingInline: 16, whiteSpace: "nowrap" } },
    },
    MuiOutlinedInput: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: { backgroundColor: "#fff", fontSize: 14 },
        notchedOutline: { borderColor: "#cdd7e4" },
      },
    },
    MuiTable: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: "12px 16px", borderColor: "#e2e8f0", fontSize: 13, verticalAlign: "top" },
        head: { backgroundColor: "#f8fafd", color: "#4a5e78", fontWeight: 700, whiteSpace: "nowrap" },
      },
    },
    MuiTableRow: { styleOverrides: { root: { "&:hover td": { backgroundColor: "#fafcff" } } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: "none" } } },
    MuiAlert: { styleOverrides: { root: { border: "1px solid", borderColor: "transparent" }, message: { minWidth: 0 } } },
    MuiChip: { defaultProps: { size: "small" }, styleOverrides: { root: { fontWeight: 650, fontSize: 12 } } },
    MuiCssBaseline: {
      styleOverrides: {
        body: { minWidth: 320, margin: 0 },
        "a": { color: "inherit", textDecoration: "none" },
        "a:focus-visible, button:focus-visible": { outline: "3px solid #87a8d7", outlineOffset: 3 },
        "::selection": { background: "#dce8f8" },
      },
    },
  },
}, zhTW);
