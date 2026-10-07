'use client'
import Image from 'next/image'
import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import {supabase} from '@/lib/supabase'
import Shell from '@/components/Shell'
const db=supabase
const statusOptions=[['confirmed','Confirmed'],['delivered_collected','Delivered / Collected'],['cancelled','Cancelled']]
const fulfilmentLabel=(v:string)=>v==='delivery'?'Delivery':v==='walk_in'?'Walk In':'Self Pick'
const iso=(d:Date)=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
const dateShift=(n:number)=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d)}
export default function Orders(){
 const [rows,setRows]=useState<any[]>([]),[q,setQ]=useState(''),[msg,setMsg]=useState(''),[dateFilter,setDateFilter]=useState('all'),[customDate,setCustomDate]=useState(''),[selected,setSelected]=useState<string[]>([])
 function statusLabel(v:string){return statusOptions.find(x=>x[0]===v)?.[1]||v||'Select Status'}
 async function updateStatus(id:string,status:string){const {error}=await db.from('orders').update({status}).eq('id',id);if(error)setMsg(error.message);else setRows(x=>x.map(o=>o.id===id?{...o,status}:o))}
 function sendWhatsApp(o:any){const phone=String(o.customer_phone||'').trim();if(!phone){window.alert('No customer phone number is saved for this order. Please enter the Customer Phone No. in Order Details first.');return}const clean=phone.replace(/\D/g,'');if(clean.length<8){window.alert('Please enter a valid customer phone number in Order Details.');return}const item=o.order_type==='Others'&&o.other_item_type?o.other_item_type:(o.order_type||'-');const total=Number(o.amount||0);const collection=o.collection_date||'-';const time=o.time_from&&o.time_to?`${o.time_from} - ${o.time_to}`:(o.time_from||o.time_to||'Flexible');const text=`花礼订购｜ORDER FORM\n\n姓名 Name：${o.customer_name||'-'}\n电话 Contact：${o.customer_phone||'-'}\n订购日期 Order Date：${o.order_date||'-'}\n取花日期 Collection Date：${collection}\n取花时间 Collection Time：${time}\n\n花礼款式 Style：${item}\n数量 Quantity：${o.quantity||1}\n价格 Price：RM ${total.toFixed(2)}\n备注 Remarks：${o.remarks||'-'}\n\n1. 鲜花无法完全复刻，照片仅供参考，最终以实际花材及成品为准。\nFresh flowers cannot be replicated exactly. Photos are for reference only; the final arrangement will be based on the actual flowers available.\n\n2. 退款政策 Refund Policy：\n所有费用一经确认取花日期后，均不可退款。\nAll payments are strictly non-refundable once the collection date has been confirmed.\n\n3. 更改日期 Date Change：\n如需更改取花日期，请至少提前 3 天提出申请。\nAny request to change the collection date must be made at least 3 days before the scheduled collection date.\n\n4. 改期费用 Rescheduling Fee：\n如在取花日期前 3 天内提出改期申请，将收取额外改期费用。\nRescheduling requests made within 3 days of the scheduled collection date will be subject to an additional rescheduling fee.\n\n感谢您选择 MONET GARDEN。\nThank you for choosing MONET GARDEN.`;window.open('https://wa.me/'+clean+'?text='+encodeURIComponent(text),'_blank')}
 async function deleteOrder(o:any){if(!window.confirm(`Delete order for ${o.customer_name||'this customer'}? It will move to Deleted History.`))return;const {error}=await db.from('orders').update({deleted_at:new Date().toISOString()}).eq('id',o.id);if(error)setMsg(error.message);else {setRows(x=>x.filter(row=>row.id!==o.id));setSelected(x=>x.filter(id=>id!==o.id))}}
 async function deleteSelected(){if(!selected.length)return;if(!window.confirm(`Delete ${selected.length} selected order${selected.length>1?'s':''}? They will move to Deleted History.`))return;const {error}=await db.from('orders').update({deleted_at:new Date().toISOString()}).in('id',selected);if(error)setMsg(error.message);else{setRows(x=>x.filter(row=>!selected.includes(row.id)));setSelected([]);setMsg(`${selected.length} order${selected.length>1?'s':''} moved to Deleted History.`)}}
 async function load(){
  setMsg('')
  const pageSize=1000
  const all:any[]=[]
  let from=0
  while(true){
    const {data,error}=await db.from('orders').select('*').is('deleted_at',null).range(from,from+pageSize-1)
    if(error){setMsg(error.message);return}
    const batch=data||[]
    all.push(...batch)
    if(batch.length<pageSize) break
    from+=pageSize
  }
  setRows(all)
}
useEffect(()=>{load()},[])
 const filtered=useMemo(()=>rows.filter(o=>{const d=o.collection_date||o.order_date;const dateOk=dateFilter==='all'||(dateFilter==='today'?d===dateShift(0):dateFilter==='tomorrow'?d===dateShift(1):dateFilter==='yesterday'?d===dateShift(-1):d===customDate);return dateOk&&JSON.stringify(o).toLowerCase().includes(q.toLowerCase())}).sort((a,b)=>{const ad=a.collection_date||a.order_date||'9999-12-31',bd=b.collection_date||b.order_date||'9999-12-31';if(ad!==bd)return ad.localeCompare(bd);return (a.time_from||'99:99').localeCompare(b.time_from||'99:99')}),[rows,q,dateFilter,customDate])
 const activeRows=rows.filter(o=>o.status!=='cancelled');
 const totalRevenue=activeRows.reduce((s,o)=>s+Number(o.amount||0),0);
 const now=new Date(); const monthPrefix=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 const thisMonthRevenue=activeRows.filter(o=>(o.order_date||'').startsWith(monthPrefix)).reduce((s,o)=>s+Number(o.amount||0),0);
 const allFilteredSelected=filtered.length>0 && filtered.every(o=>selected.includes(o.id));
 function toggleAll(){setSelected(allFilteredSelected?[]:filtered.map(o=>o.id))}
 return <Shell active="Orders">
  <div className="top">
    <div><div className="title">Orders</div><div className="sub">Active orders arranged by collection date and time</div></div>
    <div style={{display:'flex',gap:8}}><Link className="btn" href="/florists">Manage Florists</Link><Link className="btn" href="/orders/deleted">Deleted History</Link><Link className="btn primary" href="/orders/new">+ New Order</Link></div>
  </div>
  {msg&&<div className="msg">{msg}</div>}
  <div className="grid dashboardStats" style={{marginBottom:16}}><div className="card"><div className="label">Total Revenue</div><div className="num">RM {totalRevenue.toFixed(2)}</div></div><div className="card"><div className="label">This Month Revenue</div><div className="num">RM {thisMonthRevenue.toFixed(2)}</div></div></div>
  <div className="card">
    <div className="quickBar">
      <button className={dateFilter==='today'?'quickActive':''} onClick={()=>setDateFilter('today')}>Today</button>
      <button className={dateFilter==='tomorrow'?'quickActive':''} onClick={()=>setDateFilter('tomorrow')}>Tomorrow</button>
      <button className={dateFilter==='yesterday'?'quickActive':''} onClick={()=>setDateFilter('yesterday')}>Yesterday</button>
      <button className={dateFilter==='all'?'quickActive':''} onClick={()=>setDateFilter('all')}>All Orders</button>
      <input type="date" value={dateFilter==='custom'?customDate:''} onChange={e=>{setCustomDate(e.target.value);setDateFilter('custom')}}/>
    </div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginTop:14,flexWrap:'wrap'}}><input className="searchInput" style={{marginTop:0,flex:1,minWidth:280}} placeholder="Search order, customer, phone, florist or type..." value={q} onChange={e=>setQ(e.target.value)}/>{selected.length>0&&<button className="danger" onClick={deleteSelected}>Delete Selected ({selected.length})</button>}</div>
    <div className="orderCards" style={{marginTop:14}}>
      <div className="orderCardsHead"><div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><label className="selectAllControl"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll}/><span>Select All</span></label><div><strong>{filtered.length}</strong> order{filtered.length===1?'':'s'}</div>{selected.length>0&&<span className="selectedCount">{selected.length} selected</span>}</div><div className="sub">Grouped by collection, customer, item, payment and notes</div></div>
      {filtered.map(o=>{
        const paid=o.amount_paid===null||o.amount_paid===undefined||o.amount_paid===''?null:Number(o.amount_paid||0);
        const total=Number(o.amount||0);
        const balance=paid===null?null:Math.max(0,total-paid);
        const item=o.order_type==='Others'&&o.other_item_type?o.other_item_type:(o.order_type||'-');
        const time=o.time_from&&o.time_to?`${o.time_from} – ${o.time_to}`:(o.time_from||o.time_to||'Flexible');
        return <div className="orderCard" key={o.id}>
          <div className="orderCardTop">
            <label className="orderCheck"><input type="checkbox" checked={selected.includes(o.id)} onChange={e=>setSelected(x=>e.target.checked?[...x,o.id]:x.filter(id=>id!==o.id))}/><span>Select</span></label>
            <div className="orderCardStatus"><select className={'statusSelect status-'+(o.status||'')} value={o.status||''} onChange={e=>updateStatus(o.id,e.target.value)}>{statusOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          </div>
          <div className="orderGroups">
            <div className="orderGroup collectionGroup"><div className="groupLabel">Collection</div><div className="groupMain"><strong className="collectionDate">{o.collection_date||'-'}</strong><span className="collectionTime">{time}</span></div><span className="fulfilmentBadge">{fulfilmentLabel(o.fulfilment)}</span>{o.fulfilment==='delivery'&&o.address&&<div className="groupSub">{o.address}</div>}</div>
            <div className="orderGroup"><div className="groupLabel">Customer</div><div className="groupMain"><strong>{o.customer_name||'-'}</strong></div><div className="groupSub">{o.customer_phone||'No telephone number'}</div></div>
            <div className="orderGroup"><div className="groupLabel">Item</div><div className="groupMain"><strong>{item}</strong></div><div className="groupSub">Quantity <b>{o.quantity||1}</b>{o.occasion?<> · {o.occasion}</>:null}</div></div>
            <div className="orderGroup paymentGroup"><div className="groupLabel">Amount & Paid</div><div className="paymentLines"><span>Total <b>RM {total.toFixed(2)}</b></span><span>Paid <b>{paid===null?'—':`RM ${paid.toFixed(2)}`}</b></span><span className={balance===0?'paidText':'balanceText'}>Balance <b>{balance===null?'—':`RM ${balance.toFixed(2)}`}</b></span></div></div>
            <div className="orderGroup notesGroup"><div className="groupLabel">Reference & Remarks</div><div className="referenceMini">{o.reference_image_url?<a href={o.reference_image_url} target="_blank" rel="noreferrer"><img src={o.reference_image_url} alt="Reference"/></a>:<span className="noReference">No reference</span>}<div>{o.remarks?<div className="remarkText">{o.remarks}</div>:<div className="groupSub">No remarks</div>}</div></div></div>
          </div>
          <div className="orderActionBar cardActionBar"><span className="actionLabel">Order Actions</span><Link className="btn" href={`/orders/new?edit=${o.id}`}>View / Edit</Link><Link className="btn" href={`/orders/new?duplicate=${o.id}`}>Duplicate</Link><button className="danger" onClick={()=>deleteOrder(o)}>Delete</button><button className="whatsapp" onClick={()=>sendWhatsApp(o)}>WhatsApp</button></div>
        </div>
      })}
      {!filtered.length&&<div className="emptyState">No orders for this view.</div>}
    </div>
  </div>
</Shell>}
