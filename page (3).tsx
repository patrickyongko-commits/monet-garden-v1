'use client'
import Shell from '@/components/Shell'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

const db = supabase

const LOCAL_LOCATIONS = ['3rd Miles','7th Miles','Batu Kawa','Stapok','Green Road','Ban Hock','Batu Lintang','BDC','Jalan Song','Stutong','Kuching Waterfront','Pandungan','Pending','Sekama','Samarahan','Tabuan Jaya']
const OUTSTATION_AREAS = ['Serian','Sri Aman','Sibu','Bintulu','Sarikei','Mukah','Miri']
const ITEM_OPTIONS = ['Bouquet','Stands','Wholesale Bundles','Baskets','Table Arrangements']

type Customer = { id:string; customer_name:string; phone?:string|null; address?:string|null; city?:string|null; sales_area:'local'|'outstation'; is_active:boolean }
type Driver = { id:string; driver_name:string; phone?:string|null; default_commission_rate?:number|null; is_active:boolean }
type Delivery = { id:string; order_date:string; customer_id:string; driver_id?:string|null; location:string; sales_area:'local'|'outstation'; delivery_type:'local'|'outstation'; delivery_quantity:number; delivery_fee:number; items?:string|null; sales_amount:number; commission:number; status:'delivered'|'cancelled'; deleted_at?:string|null; customer?:Customer; driver?:Driver }

type CustomerStat = { id:string; name:string; phone:string; orders:number; sales:number }
type DriverStat = { id:string; name:string; phone:string; localOrders:number; outstationOrders:number; boxes:number; sales:number; commission:number }
type AreaStat = { area:string; orders:number; boxes:number; sales:number }

const money=(n:number)=>`RM ${Number(n||0).toFixed(2)}`
const today=()=>new Date().toISOString().slice(0,10)
const clean=(v:string)=>v.trim()

function exportExcel(rows:any[], filename:string, sheet='Delivery'){
  const wb=XLSX.utils.book_new()
  const ws=XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb,ws,sheet)
  XLSX.writeFile(wb,filename)
}

export default function DeliveryPage(){
  const [user,setUser]=useState<any>(null)
  const [customers,setCustomers]=useState<Customer[]>([])
  const [drivers,setDrivers]=useState<Driver[]>([])
  const [deliveries,setDeliveries]=useState<Delivery[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const [showDelivery,setShowDelivery]=useState(false)
  const [deliveryType,setDeliveryType]=useState<'local'|'outstation'>('local')
  const [showDriver,setShowDriver]=useState(false)
  const [showCustomer,setShowCustomer]=useState(false)
  const [customerView,setCustomerView]=useState<CustomerStat|null>(null)
  const [driverView,setDriverView]=useState<DriverStat|null>(null)
  const [editingId,setEditingId]=useState<string|null>(null)
  const [viewType,setViewType]=useState<'local'|'outstation'|null>(null)
  const [form,setForm]=useState({order_date:today(),customer_id:'',driver_id:'',location:'',other_location:'',sales_area:'local' as 'local'|'outstation',delivery_type:'local' as 'local'|'outstation',delivery_quantity:'1',items:'Bouquet',other_items:'',sales_amount:'0',commission:'15',status:'delivered' as 'delivered'|'cancelled'})
  const [driverForm,setDriverForm]=useState({driver_name:'',phone:''})
  const [driverEditingId,setDriverEditingId]=useState<string|null>(null)
  const [customerForm,setCustomerForm]=useState({customer_name:'',phone:'',sales_area:'local' as 'local'|'outstation'})

  useEffect(()=>{
    db.auth.getUser().then(({data})=>{setUser(data.user);if(data.user)load()})
    const {data}=db.auth.onAuthStateChange((_e,s)=>{setUser(s?.user??null);if(s)load()})
    return()=>data.subscription.unsubscribe()
  },[])

  async function load(){
    setLoading(true)
    const [{data:c},{data:d},{data:o}] = await Promise.all([
      db.from('wholesale_customers').select('*').eq('is_active',true).order('customer_name'),
      db.from('drivers').select('*').eq('is_active',true).order('driver_name'),
      db.from('wholesale_orders').select('*, customer:wholesale_customers(*), driver:drivers(*)').is('deleted_at',null).order('order_date',{ascending:false}).order('created_at',{ascending:false})
    ])
    setCustomers((c||[]) as Customer[])
    setDrivers((d||[]) as Driver[])
    setDeliveries((o||[]) as Delivery[])
    setLoading(false)
  }

  function setField(k:string,v:any){setForm(f=>({...f,[k]:v}))}
  function resetForm(type:'local'|'outstation'){
    setEditingId(null); setDeliveryType(type)
    setForm({order_date:today(),customer_id:'',driver_id:'',location:'',other_location:'',sales_area:type,delivery_type:type,delivery_quantity:'1',items:'Bouquet',other_items:'',sales_amount:'0',commission:type==='outstation'?'15':'15',status:'delivered'})
    setMessage(''); setShowDelivery(true)
  }
  function applyCustomer(id:string){
    setField('customer_id',id)
  }
  function selectType(type:'local'|'outstation'){
    setDeliveryType(type); setField('delivery_type',type); setField('sales_area',type); setField('delivery_quantity','1'); setField('commission','15')
  }
  function openEdit(o:Delivery){
    const type=o.delivery_type||o.sales_area; const isOther=type==='local'?!LOCAL_LOCATIONS.includes(o.location):!OUTSTATION_AREAS.includes(o.location)
    const itemBase=(o.items||'').split(' — ')[0]; const isOtherItem=!ITEM_OPTIONS.includes(itemBase)
    setEditingId(o.id); setDeliveryType(type)
    setForm({order_date:o.order_date,customer_id:o.customer_id,driver_id:o.driver_id||'',location:isOther?'Others':o.location||'',other_location:isOther?o.location:'',sales_area:type,delivery_type:type,delivery_quantity:String(o.delivery_quantity||1),items:isOtherItem?'Others':itemBase||'Bouquet',other_items:isOtherItem?(o.items||''):'',sales_amount:String(o.sales_amount||0),commission:String(o.commission||15),status:o.status==='cancelled'?'cancelled':'delivered'})
    setMessage(''); setShowDelivery(true)
  }
  function finalLocation(){return form.location==='Others'?clean(form.other_location):form.location}
  function finalItems(){return form.items==='Others'?clean(form.other_items):form.items}
  function barPercent(value:number, rows:AreaStat[]){const max=Math.max(...rows.map(x=>x.sales),1); return Math.max(4,(value/max)*100)}

  async function deleteDelivery(){
    if(!editingId)return
    if(!window.confirm('Move this delivery to Deleted History?'))return
    setSaving(true); setMessage('')
    const {error}=await db.from('wholesale_orders').update({deleted_at:new Date().toISOString()}).eq('id',editingId)
    if(error)setMessage(error.message);else{setShowDelivery(false);setEditingId(null);await load();setMessage('Delivery moved to Deleted History.')}
    setSaving(false)
  }

  async function saveDelivery(e:any){
    e.preventDefault(); setSaving(true); setMessage('')
    const quantity=deliveryType==='outstation'?Math.max(1,Number(form.delivery_quantity)||1):1
    const payload={order_date:form.order_date,customer_id:form.customer_id,driver_id:form.driver_id||null,location:finalLocation(),sales_area:deliveryType,delivery_type:deliveryType,delivery_quantity:quantity,delivery_fee:deliveryType==='outstation'?quantity*15:15,items:finalItems(),sales_amount:Number(form.sales_amount)||0,commission:Number(form.commission)||0,status:form.status}
    const res=editingId?await db.from('wholesale_orders').update(payload).eq('id',editingId):await db.from('wholesale_orders').insert(payload)
    if(res.error) setMessage(res.error.message)
    else {setShowDelivery(false);await load();setMessage(editingId?'Delivery updated.':'Delivery saved.')}
    setSaving(false)
  }

  function openNewDriver(){
    setDriverEditingId(null)
    setDriverForm({driver_name:'',phone:''})
    setMessage('')
    setShowDriver(true)
  }
  function openEditDriver(d:Driver){
    setDriverEditingId(d.id)
    setDriverForm({driver_name:d.driver_name,phone:d.phone||''})
    setMessage('')
    setShowDriver(true)
  }
  async function saveDriver(e:any){
    e.preventDefault(); setSaving(true); setMessage('')
    const payload={driver_name:clean(driverForm.driver_name),phone:clean(driverForm.phone)||null}
    const res=driverEditingId
      ?await db.from('drivers').update(payload).eq('id',driverEditingId)
      :await db.from('drivers').insert({...payload,default_commission_rate:0})
    if(res.error)setMessage(res.error.message)
    else{setShowDriver(false);setDriverEditingId(null);setDriverForm({driver_name:'',phone:''});await load();setMessage(driverEditingId?'Driver updated.':'Driver registered.')}
    setSaving(false)
  }
  async function deleteDriver(id:string,name:string){
    if(!window.confirm(`Delete driver "${name}"? The driver will be removed from the active driver list, while existing delivery records are kept.`))return
    setSaving(true);setMessage('')
    const {error}=await db.from('drivers').update({is_active:false}).eq('id',id)
    if(error)setMessage(error.message)
    else{if(driverEditingId===id){setDriverEditingId(null);setDriverForm({driver_name:'',phone:''});setShowDriver(false)}await load();setMessage('Driver deleted from the active list. Historical deliveries are kept.')}
    setSaving(false)
  }
  async function saveCustomer(e:any){
    e.preventDefault(); setSaving(true); setMessage('')
    const {data,error}=await db.from('wholesale_customers').insert({customer_name:clean(customerForm.customer_name),phone:clean(customerForm.phone)||null,sales_area:customerForm.sales_area}).select('*').single()
    if(error)setMessage(error.message);else{setShowCustomer(false);setCustomerForm({customer_name:'',phone:'',sales_area:'local'});await load();if(data)setField('customer_id',data.id);setMessage('Customer registered.')}
    setSaving(false)
  }
 
  const active=deliveries.filter(x=>x.status!=='cancelled')
  const local=active.filter(x=>x.sales_area==='local')
  const outstation=active.filter(x=>x.sales_area==='outstation')
  const localCommission=local.reduce((s,x)=>s+Number(x.commission||0),0)
  const outCommission=outstation.reduce((s,x)=>s+Number(x.commission||0),0)
  const localSales=local.reduce((s,x)=>s+Number(x.sales_amount||0),0)
  const outSales=outstation.reduce((s,x)=>s+Number(x.sales_amount||0),0)
  const totalBoxes=outstation.reduce((s,x)=>s+Number(x.delivery_quantity||0),0)

  const localAreaStats=useMemo<AreaStat[]>(()=>{
    const map:Record<string,AreaStat>={};
    local.forEach(o=>{const area=o.location||'Others';if(!map[area])map[area]={area,orders:0,boxes:0,sales:0};map[area].orders++;map[area].sales+=Number(o.sales_amount||0)});
    return Object.values(map).sort((a,b)=>b.sales-a.sales || a.area.localeCompare(b.area))
  },[deliveries])

  const outstationAreaStats=useMemo<AreaStat[]>(()=>{
    const map:Record<string,AreaStat>={};
    outstation.forEach(o=>{const area=o.location||'Others';if(!map[area])map[area]={area,orders:0,boxes:0,sales:0};map[area].orders++;map[area].boxes+=Number(o.delivery_quantity||0);map[area].sales+=Number(o.sales_amount||0)});
    return Object.values(map).sort((a,b)=>b.sales-a.sales || a.area.localeCompare(b.area))
  },[deliveries])

  const customerStats=useMemo<CustomerStat[]>(()=>{
    const map:Record<string,CustomerStat>={}
    customers.forEach(c=>{map[c.id]={id:c.id,name:c.customer_name,phone:c.phone||'',orders:0,sales:0}})
    active.forEach(o=>{const id=o.customer_id;if(!map[id])map[id]={id,name:o.customer?.customer_name||'Unknown',phone:o.customer?.phone||'',orders:0,sales:0};map[id].orders++;map[id].sales+=Number(o.sales_amount||0)})
    return Object.values(map).sort((a,b)=>b.sales-a.sales || a.name.localeCompare(b.name))
  },[deliveries,customers])

  const driverStats=useMemo<DriverStat[]>(()=>{
    const map:Record<string,DriverStat>={}
    drivers.forEach(d=>{map[d.id]={id:d.id,name:d.driver_name,phone:d.phone||'',localOrders:0,outstationOrders:0,boxes:0,sales:0,commission:0}})
    active.forEach(o=>{if(!o.driver_id)return;const d=o.driver;const id=o.driver_id;if(!map[id])map[id]={id,name:d?.driver_name||'Unknown',phone:d?.phone||'',localOrders:0,outstationOrders:0,boxes:0,sales:0,commission:0};if(o.sales_area==='local')map[id].localOrders++;else{map[id].outstationOrders++;map[id].boxes+=Number(o.delivery_quantity||0)}map[id].sales+=Number(o.sales_amount||0);map[id].commission+=Number(o.commission||0)})
    return Object.values(map).sort((a,b)=>b.commission-a.commission || a.name.localeCompare(b.name))
  },[deliveries,drivers])

  const customerDeliveries=customerView?active.filter(o=>o.customer_id===customerView.id):[]
  const driverDeliveries=driverView?active.filter(o=>o.driver_id===driverView.id):[]

  function deliveryRows(rows:Delivery[]){return rows.map(o=>({
    Date:o.order_date,Customer:o.customer?.customer_name||'',Phone:o.customer?.phone||'',Driver:o.driver?.driver_name||'',Area:o.location,Items:o.items||'',Boxes:o.sales_area==='outstation'?o.delivery_quantity:1,'Delivery Fee':Number(o.delivery_fee||0),'Sales Amount':Number(o.sales_amount||0),'Driver Commission':Number(o.commission||0),Status:o.status
  }))}
  function exportLocal(){exportExcel(deliveryRows(local),'monet-garden-local-delivery.xlsx','Local Delivery')}
  function exportOutstation(){exportExcel(deliveryRows(outstation),'monet-garden-outstation-delivery.xlsx','Outstation Delivery')}
  function exportDrivers(){exportExcel(driverStats.map(x=>({Driver:x.name,Phone:x.phone,'Local Orders':x.localOrders,'Outstation Orders':x.outstationOrders,'Total Boxes':x.boxes,'Sales':x.sales,'Commission':x.commission})),'monet-garden-driver-commission.xlsx','Driver Commission')}
  function esc(v:any){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function printTable(title:string, rows:any[], columns:string[]){
    const w=window.open('','_blank','width=1100,height=760'); if(!w)return
    const head=columns.map(c=>`<th>${esc(c)}</th>`).join('')
    const body=rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')
    w.document.write(`<!doctype html><html><head><title>MONET GARDEN - ${esc(title)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h1{font-size:20px;margin:0 0 4px}p{color:#666;font-size:12px;margin:0 0 18px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:7px 8px;text-align:left}th{background:#f5f5f5}</style></head><body><h1>MONET GARDEN — ${esc(title)}</h1><p>Printed ${new Date().toLocaleString()}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},250)
  }
  function printDeliveryReport(title:string, rows:Delivery[]){printTable(title,deliveryRows(rows),['Date','Customer','Phone','Driver','Area','Items','Boxes','Delivery Fee','Sales Amount','Driver Commission','Status'])}
  function printDriverReport(d:DriverStat){printTable(`Driver Commission - ${d.name}`,deliveryRows(driverDeliveriesFor(d.id)),['Date','Customer','Phone','Driver','Area','Items','Boxes','Delivery Fee','Sales Amount','Driver Commission','Status'])}
  function driverDeliveriesFor(id:string){return active.filter(o=>o.driver_id===id)}

  if(!user)return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20}}><div className="card" style={{width:'min(430px,100%)',textAlign:'center'}}><Image src="/logo.png" alt="MONET GARDEN" width={145} height={145} className="logo"/><h1>MONET GARDEN</h1><Link className="btn primary" href="/">Back to Sign In</Link></div></main>

  return <Shell active="Delivery"><div className="main deliveryPrintRoot">
      <header className="top"><div><div className="title">Delivery</div><div className="sub">Local and outstation delivery records</div></div><div style={{display:'flex',gap:8}}><button className="btn" onClick={()=>setShowCustomer(true)}>Customers</button><button className="btn" onClick={openNewDriver}>Drivers Register</button><Link className="btn" href="/delivery/deleted">Deleted History</Link></div></header>
      {message&&<div className="notice">{message}</div>}
      <section className="deliveryTypeGrid section">
        <div className="card deliveryHero" onClick={()=>setViewType('local')} role="button" tabIndex={0}><div><div className="eyebrow">LOCAL DELIVERY</div><h2>{local.length} <span>Total delivery orders</span></h2><div className="sub">Driver commission: <b>{money(localCommission)}</b></div></div><div className="buttonStack"><button className="primary" onClick={(e)=>{e.stopPropagation();resetForm('local')}}>+ New Delivery</button><div className="miniActions"><button className="btn" onClick={(e)=>{e.stopPropagation();printDeliveryReport('Local Delivery',local)}}>Print</button><button className="btn" onClick={(e)=>{e.stopPropagation();exportLocal()}}>Export Excel</button></div></div></div>
        <div className="card deliveryHero" onClick={()=>setViewType('outstation')} role="button" tabIndex={0}><div><div className="eyebrow">OUTSTATION DELIVERY</div><h2>{totalBoxes} <span>Total boxes orders</span></h2><div className="sub">Driver commission: <b>{money(outCommission)}</b></div></div><div className="buttonStack"><button className="primary" onClick={(e)=>{e.stopPropagation();resetForm('outstation')}}>+ New Delivery</button><div className="miniActions"><button className="btn" onClick={(e)=>{e.stopPropagation();printDeliveryReport('Outstation Delivery',outstation)}}>Print</button><button className="btn" onClick={(e)=>{e.stopPropagation();exportOutstation()}}>Export Excel</button></div></div></div>
      </section>

      <section className="section analyticsGrid">
        <div className="card analyticsCard"><div className="sectionHead"><div><h2>Local Sales by Area</h2><div className="sub">Sales performance by local delivery area.</div></div><Link className="btn" href="/delivery-report">Report</Link></div><div className="analyticsSummary"><div><span className="groupLabel">Total Sales</span><strong>{money(localSales)}</strong></div><div><span className="groupLabel">Delivery Orders</span><strong>{local.length}</strong></div><div><span className="groupLabel">Delivery Fees</span><strong>{money(local.reduce((s,x)=>s+Number(x.delivery_fee||0),0))}</strong></div></div><div className="analyticsBars">{localAreaStats.map(a=><div className="analyticsRow" key={a.area}><div className="analyticsLabel"><span>{a.area}</span><b>{money(a.sales)}</b></div><div className="analyticsTrack"><span style={{width:`${barPercent(a.sales,localAreaStats)}%`}} /></div></div>)}{!localAreaStats.length&&<div className="emptyState">No local sales yet.</div>}</div></div>
        <div className="card analyticsCard"><div className="sectionHead"><div><h2>Outstation Sales by Area</h2><div className="sub">Sales performance by outstation area.</div></div><Link className="btn" href="/delivery-report">Report</Link></div><div className="analyticsSummary"><div><span className="groupLabel">Total Sales</span><strong>{money(outSales)}</strong></div><div><span className="groupLabel">Total Boxes</span><strong>{totalBoxes}</strong></div><div><span className="groupLabel">Delivery Fees</span><strong>{money(outstation.reduce((s,x)=>s+Number(x.delivery_fee||0),0))}</strong></div></div><div className="analyticsBars">{outstationAreaStats.map(a=><div className="analyticsRow" key={a.area}><div className="analyticsLabel"><span>{a.area} · {a.boxes} boxes</span><b>{money(a.sales)}</b></div><div className="analyticsTrack"><span style={{width:`${barPercent(a.sales,outstationAreaStats)}%`}} /></div></div>)}{!outstationAreaStats.length&&<div className="emptyState">No outstation sales yet.</div>}</div></div>
      </section>

      {viewType&&<section className="section card"><div className="sectionHead"><div><h2>{viewType==='local'?'Local Delivery':'Outstation Delivery'} — All Details</h2><div className="sub">{viewType==='local'?local.length:outstation.length} active records</div></div><div className="miniActions"><button className="btn" onClick={()=>setViewType(null)}>← Back</button><button className="btn" onClick={()=>printDeliveryReport(viewType==='local'?'Local Delivery':'Outstation Delivery',viewType==='local'?local:outstation)}>Print</button><button className="btn" onClick={viewType==='local'?exportLocal:exportOutstation}>Export Excel</button><button className="primary" onClick={()=>resetForm(viewType)}>+ New Delivery</button></div></div><div className="tableWrap"><table className="table"><thead><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Driver</th><th>{viewType==='local'?'Location':'Area'}</th><th>Items</th><th>{viewType==='outstation'?'Boxes':'Amount'}</th><th>Delivery Fee</th><th>Sales</th><th>Commission</th><th>Status</th><th>Actions</th></tr></thead><tbody>{(viewType==='local'?local:outstation).map(o=><tr key={o.id}><td>{o.order_date}</td><td>{o.customer?.customer_name||'—'}</td><td>{o.customer?.phone||'—'}</td><td>{o.driver?.driver_name||'—'}</td><td>{o.location}</td><td>{o.items||'—'}</td><td>{viewType==='outstation'?o.delivery_quantity:money(o.sales_amount)}</td><td>{money(o.delivery_fee)}</td><td>{money(o.sales_amount)}</td><td>{money(o.commission)}</td><td>{o.status}</td><td><button className="btn" onClick={()=>openEdit(o)}>Edit</button></td></tr>)}{!(viewType==='local'?local:outstation).length&&<tr><td colSpan={12}><div className="emptyState">No records yet.</div></td></tr>}</tbody></table></div></section>}

      <section className="section splitCards">
        <section className="section card"><div className="sectionHead"><div><h2>Customer Sales</h2><div className="sub">Click a customer to view sales history.</div></div><button className="btn" onClick={()=>setShowCustomer(true)}>+ New Customer</button></div><div className="tableWrap"><table className="table"><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total Sales</th><th></th></tr></thead><tbody>{customerStats.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone||'—'}</td><td>{c.orders}</td><td><strong>{money(c.sales)}</strong></td><td><button className="btn" onClick={()=>setCustomerView(c)}>View Sales</button></td></tr>)}{!customerStats.length&&<tr><td colSpan={5}><div className="emptyState">No delivery sales yet.</div></td></tr>}</tbody></table></div></section>
        <section className="section card"><div className="sectionHead"><div><h2>Driver Commission</h2><div className="sub">Local delivery orders, outstation boxes and total commission.</div></div><div className="miniActions"><button className="btn" onClick={()=>printTable('Driver Commission',driverStats.map(x=>({Driver:x.name,'Total Local Delivery Orders':x.localOrders,'Total Outstation Boxes':x.boxes,Commission:money(x.commission)})),['Driver','Total Local Delivery Orders','Total Outstation Boxes','Commission'])}>Print</button><button className="btn" onClick={()=>exportExcel(driverStats.map(x=>({Driver:x.name,'Total Local Delivery Orders':x.localOrders,'Total Outstation Boxes':x.boxes,Commission:x.commission})),'monet-garden-driver-commission.xlsx','Driver Commission')}>Export Excel</button><button className="primary" onClick={openNewDriver}>+ Register Driver</button></div></div><div className="tableWrap"><table className="table"><thead><tr><th>Driver</th><th>Total Local Delivery Orders</th><th>Total Outstation Boxes</th><th>Commission</th><th></th></tr></thead><tbody>{driverStats.map(d=><tr key={d.id}><td><strong>{d.name}</strong></td><td>{d.localOrders}</td><td>{d.boxes}</td><td><strong>{money(d.commission)}</strong></td><td><button className="btn" onClick={()=>setDriverView(d)}>View Details</button></td></tr>)}{!driverStats.length&&<tr><td colSpan={5}><div className="emptyState">No driver commission records yet.</div></td></tr>}</tbody></table></div></section>
      </section>

      <section className="section card"><div className="sectionHead"><div><h2>Recent Deliveries</h2><div className="sub">Local and outstation records are kept separate.</div></div></div>{loading?<div className="emptyState">Loading...</div>:<div className="deliveryList">{deliveries.map(o=><div className="deliveryRow" key={o.id}><div><strong>{o.customer?.customer_name||'Unknown'}</strong><div className="groupSub">{o.order_date} · {o.sales_area==='local'?'Local':'Outstation'}</div></div><div><b>{o.location}</b><div className="groupSub">{o.items||'—'}</div></div><div><b>{money(o.sales_amount)}</b><div className="groupSub">Commission {money(o.commission)}</div></div><div className="miniActions"><span className={`status-badge delivery-status-${o.status}`}>{o.status}</span><button className="btn" onClick={()=>openEdit(o)}>Edit</button></div></div>)}{!deliveries.length&&<div className="emptyState">No delivery records yet.</div>}</div>}</section>

      {showDelivery&&<div className="modalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setShowDelivery(false)}}><form className="modal card" onSubmit={saveDelivery}><div className="modalHead"><div><h2>{editingId?'Edit Delivery':deliveryType==='local'?'New Local Delivery':'New Outstation Delivery'}</h2><div className="sub">Only the information you need for delivery records.</div></div><button type="button" onClick={()=>setShowDelivery(false)}>✕</button></div><div className="form neatForm">
        <div className="field"><label>Date</label><input type="date" value={form.order_date} onChange={e=>setField('order_date',e.target.value)} required/></div>
        <div className="field"><label>Driver Name</label><select value={form.driver_id} onChange={e=>{setField('driver_id',e.target.value);if(!editingId)setField('commission','15')}} required><option value="">Select driver</option>{drivers.map(d=><option key={d.id} value={d.id}>{d.driver_name}</option>)}</select></div>
        <div className="field full"><label>Customer Name & Phone</label><div className="inlineFields"><select value={form.customer_id} onChange={e=>applyCustomer(e.target.value)} required><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.customer_name} {c.phone?`· ${c.phone}`:''}</option>)}</select><button type="button" className="btn" onClick={()=>setShowCustomer(true)}>+ Customer</button></div></div>
        {deliveryType==='local'?<div className="field full"><label>Location</label><select value={form.location} onChange={e=>setField('location',e.target.value)} required><option value="">Select location</option>{LOCAL_LOCATIONS.map(x=><option key={x} value={x}>{x}</option>)}<option value="Others">Others</option></select>{form.location==='Others'&&<input value={form.other_location} onChange={e=>setField('other_location',e.target.value)} placeholder="Type location" required/>}</div>:<div className="field full"><label>Area</label><select value={form.location} onChange={e=>setField('location',e.target.value)} required><option value="">Select area</option>{OUTSTATION_AREAS.map(x=><option key={x} value={x}>{x}</option>)}<option value="Others">Others</option></select>{form.location==='Others'&&<input value={form.other_location} onChange={e=>setField('other_location',e.target.value)} placeholder="Type area" required/>}</div>}
        <div className="field full"><label>Items</label><select value={form.items} onChange={e=>setField('items',e.target.value)} required>{ITEM_OPTIONS.map(x=><option key={x} value={x}>{x}</option>)}<option value="Others">Others</option></select>{form.items==='Others'&&<input value={form.other_items} onChange={e=>setField('other_items',e.target.value)} placeholder="Type item" required/>}</div>
        {deliveryType==='outstation'&&<div className="field"><label>Quantity of Boxes</label><input type="number" min="1" step="1" value={form.delivery_quantity} onChange={e=>{const q=Math.max(1,Number(e.target.value)||1);setField('delivery_quantity',e.target.value);if(!editingId)setField('commission',String(q*15))}} required/><div className="sub">Delivery fee: RM{(Math.max(1,Number(form.delivery_quantity)||1)*15).toFixed(2)} · Commission default: RM{(Math.max(1,Number(form.delivery_quantity)||1)*15).toFixed(2)} · editable</div></div>}
        <div className="field"><label>Total Amount (RM)</label><input type="number" min="0" step="0.01" value={form.sales_amount} onChange={e=>setField('sales_amount',e.target.value)} required/></div>
        <div className="field"><label>Driver Commission (RM)</label><input type="number" min="0" step="0.01" value={form.commission} onChange={e=>setField('commission',e.target.value)} required/><div className="sub">Default: RM{deliveryType==='local'?'15.00':(Math.max(1,Number(form.delivery_quantity)||1)*15).toFixed(2)} · editable</div></div>
        <div className="field"><label>Status</label><select value={form.status} onChange={e=>setField('status',e.target.value)}><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></div>
      </div><div className="modalActions"><button type="button" className="btn" onClick={()=>setShowDelivery(false)}>Cancel</button>{editingId&&<button type="button" className="danger" onClick={deleteDelivery} disabled={saving}>Delete</button>}<button className="primary" disabled={saving}>{saving?'Saving...':'Save Delivery'}</button></div></form></div>}

      {showDriver&&<div className="modalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target){setShowDriver(false);setDriverEditingId(null)}}}><div className="modal card" style={{width:'min(760px,100%)'}}><div className="modalHead"><div><h2>Drivers Register</h2><div className="sub">Add, edit or delete active drivers.</div></div><button type="button" onClick={()=>{setShowDriver(false);setDriverEditingId(null)}}>✕</button></div><form onSubmit={saveDriver}><div className="form"><div className="field"><label>Driver Name</label><input value={driverForm.driver_name} onChange={e=>setDriverForm({...driverForm,driver_name:e.target.value})} required/></div><div className="field"><label>Phone</label><input value={driverForm.phone} onChange={e=>setDriverForm({...driverForm,phone:e.target.value})}/></div></div><div className="modalActions"><button type="button" className="btn" onClick={()=>{setDriverEditingId(null);setDriverForm({driver_name:'',phone:''})}}>Clear</button><button className="primary" disabled={saving}>{saving?(driverEditingId?'Saving...':'Registering...'):(driverEditingId?'Save Changes':'Register Driver')}</button></div></form><div className="section card" style={{marginTop:16}}><div className="sectionHead"><div><h3 style={{margin:0}}>Active Drivers</h3><div className="sub">Edit or delete a driver below.</div></div></div><div className="tableWrap"><table className="table"><thead><tr><th>Driver</th><th>Phone</th><th></th></tr></thead><tbody>{drivers.map(d=><tr key={d.id}><td><strong>{d.driver_name}</strong></td><td>{d.phone||'—'}</td><td><div className="miniActions"><button type="button" className="btn" onClick={()=>openEditDriver(d)}>Edit</button><button type="button" className="danger" onClick={()=>deleteDriver(d.id,d.driver_name)} disabled={saving}>Delete</button></div></td></tr>)}{!drivers.length&&<tr><td colSpan={3}><div className="emptyState">No active drivers.</div></td></tr>}</tbody></table></div></div></div></div>}

      {showCustomer&&<div className="modalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setShowCustomer(false)}}><form className="modal card smallModal" onSubmit={saveCustomer}><div className="modalHead"><h2>New Delivery Customer</h2><button type="button" onClick={()=>setShowCustomer(false)}>✕</button></div><div className="form"><div className="field full"><label>Customer Name</label><input value={customerForm.customer_name} onChange={e=>setCustomerForm({...customerForm,customer_name:e.target.value})} required/></div><div className="field full"><label>Phone</label><input value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})}/></div><div className="field full"><label>Type</label><select value={customerForm.sales_area} onChange={e=>setCustomerForm({...customerForm,sales_area:e.target.value as any})}><option value="local">Local</option><option value="outstation">Outstation</option></select></div></div><div className="modalActions"><button type="button" className="btn" onClick={()=>setShowCustomer(false)}>Cancel</button><button className="primary" disabled={saving}>{saving?'Saving...':'Save Customer'}</button></div></form></div>}

      {customerView&&<div className="modalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setCustomerView(null)}}><div className="modal card reportModal"><div className="modalHead"><div><h2>{customerView.name}</h2><div className="sub">{customerView.phone||'No phone'} · {customerView.orders} orders · {money(customerView.sales)}</div></div><button onClick={()=>setCustomerView(null)}>✕</button></div><div className="miniActions reportActions"><button className="btn" onClick={()=>printTable(`Customer Sales - ${customerView.name}`,deliveryRows(customerDeliveries),['Date','Customer','Phone','Driver','Area','Items','Boxes','Delivery Fee','Sales Amount','Driver Commission','Status'])}>Print</button><button className="btn" onClick={()=>exportExcel(deliveryRows(customerDeliveries),`customer-${customerView.name.replace(/[^a-z0-9]+/gi,'-')}.xlsx`,'Customer Sales')}>Export Excel</button></div><div className="tableWrap"><table className="table"><thead><tr><th>Date</th><th>Type</th><th>Area</th><th>Items</th><th>Sales</th><th>Commission</th></tr></thead><tbody>{customerDeliveries.map(o=><tr key={o.id}><td>{o.order_date}</td><td>{o.sales_area}</td><td>{o.location}</td><td>{o.items}</td><td>{money(o.sales_amount)}</td><td>{money(o.commission)}</td></tr>)}</tbody></table></div></div></div>}

      {driverView&&<div className="modalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setDriverView(null)}}><div className="modal card reportModal"><div className="modalHead"><div><h2>{driverView.name}</h2><div className="sub">Commission: {money(driverView.commission)} · Sales: {money(driverView.sales)}</div></div><button onClick={()=>setDriverView(null)}>✕</button></div><div className="miniActions reportActions"><button className="btn" onClick={()=>printDriverReport(driverView)}>Print</button><button className="btn" onClick={()=>exportExcel(deliveryRows(driverDeliveries),`driver-${driverView.name.replace(/[^a-z0-9]+/gi,'-')}.xlsx`,'Driver Deliveries')}>Export Excel</button></div><div className="tableWrap"><table className="table"><thead><tr><th>Date</th><th>Type</th><th>Customer</th><th>Area</th><th>Boxes</th><th>Sales</th><th>Commission</th></tr></thead><tbody>{driverDeliveries.map(o=><tr key={o.id}><td>{o.order_date}</td><td>{o.sales_area}</td><td>{o.customer?.customer_name}</td><td>{o.location}</td><td>{o.sales_area==='outstation'?o.delivery_quantity:1}</td><td>{money(o.sales_amount)}</td><td>{money(o.commission)}</td></tr>)}</tbody></table></div></div></div>}
    </div></Shell>
}