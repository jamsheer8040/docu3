const {test}=require('node:test'),assert=require('node:assert/strict');
const {draft,validateMessage,escapeHtml}=require('../utils/documentReminderEmail');
test('expiry drafts include document and recipient details for future, due and overdue dates',()=>{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const doc={expiry_date:today,type:'Visa',doc_number:'V-1',Customer:{name:'Customer',email:'to@example.test'}};
 const due=draft(doc,'Company');assert.match(due.body,/expires today/);assert.equal(due.to,'to@example.test');assert.match(due.body,/Company/);
 assert.match(draft({...doc,expiry_date:'2000-01-01'},'Company').body,/expired \d+ day/);
 assert.match(draft({...doc,expiry_date:'2099-01-01'},'Company').body,/expires in \d+ day/);
});
test('message validation rejects injected headers, malformed recipients and excessive CC',()=>{
 const message={to:'to@example.test',subject:'Renewal',body:'Please renew',cc:'cc@example.test; to@example.test'};
 assert.deepEqual(validateMessage(message).cc,['cc@example.test']);
 for(const invalid of [{to:'x@example.test\r\nBcc:bad'},{subject:'Hi\nBcc:bad'},{cc:['bad']},{body:' '.repeat(20)},{cc:5}])assert.throws(()=>validateMessage({...message,...invalid}));
 assert.equal(escapeHtml('<b> & "\''),'&lt;b&gt; &amp; &quot;&#39;');
});
