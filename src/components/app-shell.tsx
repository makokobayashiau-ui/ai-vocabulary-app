import { AppHeader } from "@/components/app-header";
export function AppShell({children}:{children:React.ReactNode}) { return <><AppHeader/><main>{children}</main></>; }
