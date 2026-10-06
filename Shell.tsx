'use client'
import Image from 'next/image'
import Link from 'next/link'
import {supabase} from '@/lib/supabase'

export default function Shell({children,active}:{children:React.ReactNode,active:string}){
 const items=[['Dashboard','/'],['Orders','/orders'],['Customers','/customers'],['Delivery','/delivery'],['Delivery Report','/delivery-report'],['Sales Report','/reports']]
 return <div className="wrap"><aside className="side"><Image src="/logo.png" alt="MONET GARDEN" width={145} height={145} className="logo"/><nav className="nav">{items.map(([n,h])=><Link key={h} className={active===n?'active':''} href={h}>{n}</Link>)}</nav><button className="signOutBtn" onClick={()=>supabase.auth.signOut()}>Sign out</button></aside><main className="main">{children}</main></div>
}
