'use client'
import Image from 'next/image'
import Link from 'next/link'
import {Suspense,useEffect,useRef,useState} from 'react'
import {useRouter,useSearchParams} from 'next/navigation'
import {supabase} from '@/lib/supabase'
import Shell from '@/components/Shell'
const db=supabase
const types=['Bouquet','Bridal Bouquet','Corsage','Basket','Stand','Table Arrangement','Vase','Wedding Deco','Centerpiece','Workshop','Others']
const occasions=['Anniversary','Birthday','Congratulations','Condolences',"Father’s Day",'Get Well Soon','Graduation','House Warming',"Mother’s Day",'Others',"Valentine’s Day",'Wedding']
const fulfilments=[['self_pick','Self Pick'],['delivery','Delivery'],['walk_in','Walk In']]
const statuses=[['confirmed','Confirmed'],['delivered_collected','Delivered / Collected'],['cancelled','Cancelled']]
function today(){return new Date().toISOString().slice(0,10)}
function Page(){
 const r=useRouter(),params=useSearchParams(),fileRef=useRef<HTMLInputElement|null>(null)
 const duplicateId=params.get('duplicate'),editId=params.get('edit')
 const [florists,setFlorists]=useState<any[]>([]),[saving,setSaving]=useState(false),[msg,setMsg]=useState(''),[photoPreview,setPhotoPreview]=useState<string|null>(null),[photoFile,setPhotoFile]=useState<File|null>(null)
 const [f,setF]=useState<any>({order_date:today(),collection_date:'',time_from:'',time_to:'',florist_name:'',customer_name:'',customer_phone:'',occasion:'',order_type:'Bouquet',other_item_type:'',quantity:1,unit_price:'',amount:'',status:'confirmed',fulfilment:'self_pick',address:'',wishing_card:false,wishing_message:'',reference_image_url:'',remarks:''})
 useEffect(()=>{db.from('florists').select('*').eq('active',true).order('name').then(({data})=>setFlorists(data||[]));if(editId)loadOrder(editId);else if(duplicateId)loadOrder(duplicateId,true)},[editId,duplicateId])
 async function loadOrder(id:string,duplicate=false){const {data,error}=await db.from('orders').select('*').eq('id',id).single();if(error){setMsg(error.message);return};const qty=Number(data.quantity||1),unit=data.unit_price!==null&&data.unit_price!==undefined?data.unit_price:(Number(data.amount||0)/Math.max(qty,1));setF({order_date:duplicate?'':data.order_date||today(),collection_date:duplicate?'':data.collection_date||'',time_from:duplicate?'':data.time_from||'',time_to:duplicate?'':data.time_to||'',florist_name:data.florist_name||'',customer_name:data.customer_name||'',customer_phone:data.customer_phone||'',occasion:data.occasion||'',order_type:data.order_type||'Bouquet',other_item_type:data.other_item_type||'',quantity:qty,unit_price:duplicate?'':unit,amount:duplicate?'':(data.amount??''),status:duplicate?'confirmed':(data.status||'confirmed'),fulfilment:data.fulfilment||'self_pick',address:data.address||'',wishing_card:!!data.wishing_card,wishing_message:data.wishing_message||'',reference_image_url:data.reference_image_url||'',remarks:data.remarks||''});setPhotoPreview(data.reference_image_url||null);if(duplicate)setMsg('Order details copied. Please select the new order and collection schedule.')}
 function update(k:string,v:any){setF((x:any)=>({...x,[k]:v}))}
 async function compressImage(file:File){
  if(!file.type.startsWith('image/')) return file
  const originalSize=file.size
  const maxSize=2000, targetMin=500*1024, targetMax=850*1024
  const bitmap=await createImageBitmap(file)
  const scale=Math.min(1,maxSize/Math.max(bitmap.width,bitmap.height))
  const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale))
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();return file}
  ctx.drawImage(bitmap,0,0,width,height);bitmap.close()
  const encode=async(q:number)=>await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',q))
  let quality=0.85,blob=await encode(quality)
  if(!blob)return file
  if(originalSize>targetMin && blob.size<targetMin){
    blob=await encode(0.95)
  }
  if(blob && blob.size>targetMax){
    let lo=0.55,hi=quality,best:Blob|null=null
    for(let i=0;i<7;i++){const q=(lo+hi)/2;const b=await encode(q);if(!b)break;if(b.size>targetMax){hi=q}else{best=b;lo=q}}
    if(best)blob=best
  }
  if(!blob)return file
  // Never inflate a small original just to hit a size target.
  if(originalSize<targetMin && blob.size>originalSize) return file
  const base=(file.name.replace(/\.[^.]+$/,'')||'reference-image').replace(/[^a-z0-9_-]+/gi,'_')
  return new File([blob],`${base}.jpg`,{type:'image/jpeg',lastModified:Date.now()})
}
 async function preparePhoto(file:File){
  try{const compressed=await compressImage(file);setPhotoFile(compressed);setPhotoPreview(URL.createObjectURL(compressed));setMsg(`Image prepared: ${(compressed.size/1024).toFixed(0)} KB. It will be uploaded automatically when you save.`)}
  catch{setPhotoFile(file);setPhotoPreview(URL.createObjectURL(file));setMsg('Image preview ready. Compression will be attempted when saving.')}
 }
 async function choosePhoto(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;await preparePhoto(file)}
 function pastePhoto(e:React.ClipboardEvent<HTMLDivElement>){const items=Array.from(e.clipboardData.items);const item=items.find(x=>x.type.startsWith('image/'));if(!item)return;const file=item.getAsFile();if(!file)return;e.preventDefault();const ext=(file.type.split('/')[1]||'png').replace('jpeg','jpg');const named=new File([file],`pasted-reference-${Date.now()}.${ext}`,{type:file.type});void preparePhoto(named)}
 async function uploadPhoto(){if(!photoFile)return f.reference_image_url||'';const file=await compressImage(photoFile);setPhotoFile(file);const path=`orders/${crypto.randomUUID()}.jpg`;const {error}=await db.storage.from('order-references').upload(path,file,{contentType:'image/jpeg',upsert:false});if(error)throw new Error(`Reference image upload failed: ${error.message}. Please run the storage setup SQL included with this package.`);const {data}=db.storage.from('order-references').getPublicUrl(path);if(!data?.publicUrl)throw new Error('Reference image URL could not be created.');return data.publicUrl}
 async function save(){setMsg('');const {data:{user}}=await db.auth.getUser();if(!user){setMsg('Please sign in.');return}if(!f.order_date){setMsg('Order Date is required.');return}if(!f.collection_date){setMsg('Collection Date is required.');return}if(!f.florist_name){setMsg('Please select a Florist.');return}if(!f.customer_name.trim()||!f.customer_phone.trim()){setMsg('Customer Name and Phone Number are required.');return}if(!f.order_type){setMsg('Please select an Item Type.');return}if(f.order_type==='Others'&&!f.other_item_type.trim()){setMsg('Please enter the Other Item Type.');return}if(Number(f.quantity)<1){setMsg('Quantity must be at least 1.');return}if(Number(f.unit_price)<0){setMsg('Unit Price cannot be negative.');return}if(f.time_from&&f.time_to&&f.time_from>f.time_to){setMsg('Time From must be before Time To.');return}if(f.fulfilment==='delivery'&&!f.address.trim()){setMsg('Please enter the Delivery Address.');return}setSaving(true);let imageUrl='';try{imageUrl=await uploadPhoto()}catch(e:any){setSaving(false);setMsg(e?.message||'Unable to save the reference image.');return}const qty=Math.max(1,Number(f.quantity||1)),unit=Math.max(0,Number(f.unit_price||0)),total=qty*unit;const payload={order_date:f.order_date,collection_date:f.collection_date,time_from:f.time_from||null,time_to:f.time_to||null,florist_name:f.florist_name,customer_name:f.customer_name.trim(),customer_phone:f.customer_phone.trim(),occasion:f.occasion||null,order_type:f.order_type,other_item_type:f.order_type==='Others'?(f.other_item_type||null):null,quantity:qty,unit_price:unit,amount:total,status:f.status||'confirmed',fulfilment:f.fulfilment,address:f.fulfilment==='delivery'?(f.address||null):null,wishing_card:!!f.wishing_card,wishing_message:f.wishing_card?(f.wishing_message||null):null,reference_image_url:imageUrl||null,remarks:f.remarks||null};const result=editId?await db.from('orders').update(payload).eq('id',editId):await db.from('orders').insert({...payload,created_by:user.id,deleted_at:null});setSaving(false);if(result.error){setMsg(result.error.message);return}r.push('/orders')}
 async function softDelete(){if(!editId){setMsg('Save the order first before deleting it.');return}if(!window.confirm('Move this order to Deleted History?'))return;const {error}=await db.from('orders').update({deleted_at:new Date().toISOString()}).eq('id',editId);if(error)setMsg(error.message);else r.push('/orders/deleted')}
 function duplicate(){if(editId)r.push(`/orders/new?duplicate=${editId}`);else setMsg('Save the order first before duplicating it.')}
 function printTicket(){window.print()}
 return <Shell active="Orders"><div className="top"><div><div className="title">{editId?'Edit Order':'New Order'}</div><div className="sub">Create a MONET GARDEN flower order</div></div><Link className="btn" href="/orders">← Back</Link></div>{msg&&<div className="msg">{msg}</div>}<div className="card"><div className="form neatForm orderFlow">
 <Field label="Order Date"><input required type="date" value={f.order_date} onChange={e=>update('order_date',e.target.value)}/></Field>
 <Field label="Collection Date"><input required type="date" value={f.collection_date} onChange={e=>update('collection_date',e.target.value)}/></Field>
 <Field label="Time From"><TimeSelect value={f.time_from} onChange={(v)=>update('time_from',v)} /><div className="sub">Optional · 30-minute intervals</div></Field>
 <Field label="Time To"><TimeSelect value={f.time_to} onChange={(v)=>update('time_to',v)} /><div className="sub">Optional · 30-minute intervals</div></Field>
 <Field label="Florist"><select value={f.florist_name} onChange={e=>update('florist_name',e.target.value)}><option value="">Select florist</option>{florists.map(x=><option key={x.id}>{x.name}</option>)}</select></Field>
 <Field label="Customer Name"><input required value={f.customer_name} onChange={e=>update('customer_name',e.target.value)} placeholder="Enter customer name"/></Field>
 <Field label="Customer Phone No."><input required value={f.customer_phone} onChange={e=>update('customer_phone',e.target.value)} placeholder="Enter phone number"/></Field>
 <Field label="Occasion"><select value={f.occasion} onChange={e=>update('occasion',e.target.value)}><option value="">Select occasion</option>{occasions.map(x=><option key={x}>{x}</option>)}</select></Field>
 <Field label="Item Type"><select value={f.order_type} onChange={e=>update('order_type',e.target.value)}>{types.map(x=><option key={x}>{x}</option>)}</select></Field>
 {f.order_type==='Others'&&<Field label="Other Item Type"><input value={f.other_item_type} onChange={e=>update('other_item_type',e.target.value)} placeholder="Type item / arrangement type"/></Field>}
 <Field label="Quantity"><input type="number" min="1" step="1" value={f.quantity} onChange={e=>update('quantity',e.target.value)}/></Field>
 <Field label="Unit Price (RM)"><input type="number" min="0" step="0.01" value={f.unit_price} onChange={e=>update('unit_price',e.target.value)} placeholder="0.00"/></Field>
 <Field label="Total Amount (RM)"><input readOnly value={(Math.max(0,Number(f.quantity||0))*Math.max(0,Number(f.unit_price||0))).toFixed(2)}/></Field>
 <Field label="Status"><select className={'statusSelect status-'+f.status} value={f.status} onChange={e=>update('status',e.target.value)}>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
 <Field label="Fulfilment"><select value={f.fulfilment} onChange={e=>update('fulfilment',e.target.value)}>{fulfilments.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
 {f.fulfilment==='delivery'&&<Field label="Delivery Address" full><textarea value={f.address} onChange={e=>update('address',e.target.value)} placeholder="Enter delivery address"/></Field>}
 <Field label="Wishing Card"><select value={String(f.wishing_card)} onChange={e=>update('wishing_card',e.target.value==='true')}><option value="false">No</option><option value="true">Yes</option></select></Field>
 {f.wishing_card&&<Field label="Wishing Card Message" full><textarea value={f.wishing_message} onChange={e=>update('wishing_message',e.target.value)}/></Field>}
 <div className="field full"><label>Reference Image</label><div className="referenceBox" tabIndex={0} onPaste={pastePhoto}>{photoPreview?<div className="referenceContent"><img src={photoPreview} alt="Reference"/><div className="referenceActions"><button type="button" onClick={()=>fileRef.current?.click()}>Change Image</button><button type="button" className="danger" onClick={()=>{setPhotoFile(null);setPhotoPreview(null);update('reference_image_url','')}}>Remove</button></div></div>:<button type="button" className="btn" onClick={()=>fileRef.current?.click()}>＋ Add / Upload Reference Image</button>}<input ref={fileRef} type="file" accept="image/*" onChange={choosePhoto} style={{display:'none'}}/><div className="sub">Upload an image or press <b>Ctrl + V</b> here to paste a screenshot/reference image.</div></div></div>
 <Field label="Remarks" full><textarea value={f.remarks} onChange={e=>update('remarks',e.target.value)} placeholder="Add special instructions, notes or remarks for this order"/></Field>
 <div className="full orderActions"><div className="actionLeft">{editId&&<button type="button" className="danger" onClick={softDelete}>Delete</button>}{editId&&<button type="button" onClick={duplicate}>Duplicate</button>}<button type="button" onClick={printTicket}>Print Ticket</button></div><div className="actionRight"><Link className="btn" href="/orders">Cancel</Link><button type="button" className="primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save Order'}</button></div></div>
 </div></div><div className="printTicket"><div className="ticketBrand">MONET GARDEN SDN BHD</div><div className="ticketTitle">ORDER TICKET</div><div className="ticketGrid"><div><span>Collection Date</span><b>{f.collection_date||'-'}</b></div><div><span>Collection Time</span><b>{f.time_from&&f.time_to?f.time_from+' - '+f.time_to:(f.time_from||f.time_to||'Flexible')}</b></div><div><span>Florist</span><b>{f.florist_name||'-'}</b></div><div><span>Customer</span><b>{f.customer_name||'-'}</b></div><div><span>Phone</span><b>{f.customer_phone||'-'}</b></div><div><span>Occasion</span><b>{f.occasion||'-'}</b></div><div><span>Item</span><b>{f.order_type==='Others'&&f.other_item_type?f.other_item_type:f.order_type}</b></div><div><span>Quantity</span><b>{f.quantity||1}</b></div><div><span>Unit Price</span><b>RM {Number(f.unit_price||0).toFixed(2)}</b></div><div><span>Total</span><b>RM {(Math.max(0,Number(f.quantity||0))*Math.max(0,Number(f.unit_price||0))).toFixed(2)}</b></div><div><span>Status</span><b>{statuses.find(x=>x[0]===f.status)?.[1]||f.status}</b></div></div>{f.fulfilment==='delivery'&&<div className="ticketBlock"><span>Delivery Address</span><b>{f.address||'-'}</b></div>}<div className="ticketBlock"><span>Wishing Card</span><b>{f.wishing_card?'Yes':'No'}{f.wishing_card&&f.wishing_message?` — ${f.wishing_message}`:''}</b></div><div className="ticketBlock"><span>Remarks</span><b>{f.remarks||'-'}</b></div></div></Shell>
}
export default function NewOrder(){return <Suspense fallback={<div className="main"><div className="card">Loading…</div></div>}><Page/></Suspense>}

function TimeSelect({value,onChange}:{value:string,onChange:(value:string)=>void}){
 const options:string[]=[]
 for(let h=6;h<=21;h++) for(const m of [0,30]){
  if(h===21&&m===30) continue
  options.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
 }
 return <div className="timeButtonGrid">
  {options.map(t=>{const [h,m]=t.split(':').map(Number);const label=`${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;return <button type="button" key={t} className={'timeButton '+(value===t?'selected':'')} onClick={()=>onChange(t)}>{label}</button>})}
 </div>
}

function Field({label,children,full=false}:{label:string,children:React.ReactNode,full?:boolean}){return <div className={'field '+(full?'full':'')}><label>{label}</label>{children}</div>}
