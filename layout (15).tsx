import './globals.css'
import type { Metadata } from 'next'
export const metadata: Metadata={title:'MONET GARDEN Order Management',description:'MONET GARDEN SDN BHD florist order management'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
