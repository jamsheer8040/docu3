const defaults = Object.freeze({Pending:'#FFF1DD','In Progress':'#ECF5FF',CompletedInvoicePending:'#FFF6E5',CompletedInvoiceCreated:'#EAF7F0',FollowUpRequired:'#FFF2DE',Cancelled:'#FDEEEE'});
function colors(value,strict=false){
  if(strict && (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!(key in defaults))))throw new Error('Choose valid service footer colours.');
  return Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>{
    const color=value?.[key];
    if(strict && (typeof color!=='string' || !/^#[0-9a-f]{6}$/i.test(color)))throw new Error(`Choose a valid colour for ${key}.`);
    return [key,typeof color==='string' && /^#[0-9a-f]{6}$/i.test(color)?color.toUpperCase():fallback];
  }));
}
module.exports={defaults,colors};
