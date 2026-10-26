<template>
  <v-container fluid class="lead-detail pa-6">
    <v-btn to="/leads" variant="text" prepend-icon="mdi-arrow-left" class="mb-4">All leads</v-btn>
    <v-progress-linear v-if="loading" indeterminate color="primary" />
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}<v-btn variant="text" @click="load">Retry</v-btn></v-alert>
    <template v-if="lead">
      <header class="detail-header mb-6">
        <div><p class="text-overline">LEAD DETAILS</p><h1 class="text-h4 font-weight-bold">{{ lead.company_name }}</h1><p class="text-medium-emphasis mt-2">{{ lead.name || 'No contact person' }} · {{ lead.source || 'No source' }}</p></div>
        <div class="d-flex align-center ga-3 flex-wrap"><v-chip color="primary">{{ lead.status }}</v-chip><v-chip v-if="lead.quote_sent" color="info" variant="tonal">Quote Sent</v-chip><v-btn v-if="auth.can('quotations','create')" :to="`/quotations?action=create&lead_id=${lead.id}`" variant="tonal" prepend-icon="mdi-file-document-plus-outline">Create quotation</v-btn><v-btn v-if="canWrite" variant="tonal" prepend-icon="mdi-pencil" @click="editing = true">Edit lead</v-btn></div>
      </header>
      <div class="detail-grid">
        <main class="main-column">
          <v-card rounded="xl" class="pa-6 mb-5" flat>
            <h2 class="text-h6 mb-4">Contact & opportunity</h2>
            <dl class="contact-grid"><div v-for="item in contactFields" :key="item[0]"><dt>{{ item[0] }}</dt><dd>{{ item[1] || '—' }}</dd></div></dl>
            <p v-if="visibleLeadNotes(lead.notes)" class="notes mt-5">{{ visibleLeadNotes(lead.notes) }}</p>
            <v-alert v-if="lead.status === 'Archived'" variant="tonal" color="grey" class="mt-4"><strong>Archive reason:</strong> {{ lead.archive_reason }}<v-btn v-if="canWrite" variant="text" class="ml-2" @click="editing = true">Reopen lead</v-btn></v-alert>
          </v-card>
          <v-card rounded="xl" class="pa-6 mb-5" flat>
            <div class="detail-header mb-4"><div><h2 class="text-h6">Follow-ups</h2><p class="text-body-2 text-medium-emphasis">Completed contact activities</p></div><v-chip color="primary" size="large" class="font-weight-bold">{{ followUps.length }} total</v-chip></div>
            <div class="channel-grid"><div v-for="channel in channels" :key="channel.name" class="channel-count"><v-icon color="primary">{{ channel.icon }}</v-icon><strong>{{ count(channel.name) }}</strong><span>{{ channel.name }}</span></div></div>
            <LeadFollowUpAction ref="followUpAction" :lead="lead" class="mt-5" @saved="load" />
          </v-card>
          <div class="history-sections">
          <v-card rounded="xl" class="pa-6" flat>
            <h2 class="text-h6 mb-4">Follow-up History</h2>
            <div v-if="!followUps.length" class="text-medium-emphasis py-6 text-center">No follow-ups yet. Log your first conversation to start the history.</div>
            <article v-for="activity in followUps" :key="activity.id" class="activity">
              <v-avatar color="primary" variant="tonal"><v-icon>{{ channels.find(c => c.name === activity.channel)?.icon }}</v-icon></v-avatar>
              <div class="activity-body"><div class="detail-header"><strong>{{ activity.channel }}</strong><v-chip size="x-small" color="success" prepend-icon="mdi-check">Completed</v-chip></div><time class="text-caption text-medium-emphasis">{{ formatDate(activity.occurred_at) }}</time><p class="notes mt-2">{{ activity.notes }}</p><v-btn v-if="activity.attachment_name" variant="tonal" size="small" prepend-icon="mdi-paperclip" class="mt-3" :loading="downloadingAttachment===activity.id" @click="downloadAttachment(activity)">{{ activity.attachment_name }}</v-btn></div>
            </article>
          </v-card>
          <v-card rounded="xl" class="pa-6" flat>
            <h2 class="text-h6 mb-4">Quote History</h2>
            <p v-if="!auth.can('quotations','read')" class="text-medium-emphasis py-6">Quotation view access is required to see this history.</p>
            <v-progress-linear v-else-if="quotesLoading" indeterminate color="primary" />
            <v-alert v-else-if="quotesError" type="error" variant="tonal">{{ quotesError }}<v-btn variant="text" size="small" @click="loadQuoteHistory">Retry</v-btn></v-alert>
            <p v-else-if="!quotes.length" class="text-medium-emphasis py-6 text-center">No quotations available for this lead.</p>
            <article v-for="quote in quotes" :key="quote.id" class="activity">
              <v-avatar color="primary" variant="tonal"><v-icon>mdi-file-document-edit-outline</v-icon></v-avatar>
              <div class="activity-body">
                <div class="detail-header ga-2"><NuxtLink v-if="auth.canRecord('quotations','detail',quote)" :to="`/quotations?quotation_id=${quote.id}`" class="font-weight-bold text-primary text-decoration-none">{{ quote.quotation_number }}</NuxtLink><strong v-else>{{ quote.quotation_number }}</strong><v-chip size="x-small" :color="quoteStatusColor(quote.status)">{{ quote.status }}</v-chip></div>
                <time class="text-caption text-medium-emphasis">{{ formatQuoteDate(quote.quotation_date) }}</time>
                <p class="font-weight-bold mt-2">{{ quoteAmount(quote.total) }}</p>
                <p v-if="quote.sent_at" class="text-caption text-medium-emphasis mt-1">Sent · {{ formatDate(quote.sent_at) }}</p>
              </div>
            </article>
          </v-card>
          </div>
        </main>
        <aside>
          <v-card rounded="xl" class="pa-6 lifecycle" flat>
            <h2 class="text-h6">Lead lifecycle</h2><p class="text-body-2 text-medium-emphasis mb-5">Milestones reached and current stage</p>
            <ol class="milestones"><li v-for="stage in stages" :key="stage" :class="{ reached: reached(stage), current: lead.status === stage }"><v-icon :color="reached(stage) ? 'primary' : undefined">{{ reached(stage) ? 'mdi-check-circle' : 'mdi-circle-outline' }}</v-icon><div><strong>{{ stage }}</strong><span v-if="lead.status === stage" class="text-caption ml-2">Current</span><span v-else-if="reached(stage)" class="text-caption text-primary ml-2">Completed</span><p class="text-caption text-medium-emphasis">{{ milestoneDate(stage) || 'Not recorded' }}</p><v-btn v-if="canMarkStage(stage)" size="x-small" variant="text" :disabled="saving" @click="markStage(stage)">{{ stage === 'Follow-up' ? 'Schedule follow-up' : stage === 'Archived' ? 'Archive lead' : `Mark ${stage}` }}</v-btn></div></li></ol>
            <v-divider class="my-4" /><LeadFollowUpAction :lead="lead" compact @saved="load" />
            <template v-for="entry in lead.history?.filter(item => item.archive_reason)" :key="`archive-${entry.id}`"><p class="text-caption mt-3 notes"><strong>Archived · {{ formatDate(entry.created_at) }}</strong><br>{{ entry.archive_reason }}</p></template>
            <v-btn v-if="lead.customer_id" class="mt-4" variant="tonal" :to="`/customers/${lead.customer_id}`">View customer</v-btn>
            <h3 class="text-subtitle-2 mt-6 mb-3">Stage history</h3><p v-if="!lead.history?.length" class="text-caption">No stage changes recorded.</p><div v-for="entry in lead.history" :key="entry.id" class="stage-history"><strong>{{ entry.previous_status ? `${entry.previous_status} → ` : '' }}{{ entry.new_status }}</strong><p>{{ formatDate(entry.created_at) }}</p></div>
          </v-card>
        </aside>
      </div>
      <LeadDialog v-model="editing" :lead="editTarget || lead" @saved="load" @update:model-value="value => { if (!value) editTarget = null }" />
    </template>
  </v-container>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';
import LeadDialog from '~/components/leads/LeadDialog.vue';
import { visibleLeadNotes } from '~/utils/leadNotes';
import LeadFollowUpAction from '~/components/leads/LeadFollowUpAction.vue';
const route = useRoute();
const { $api } = useNuxtApp();
const auth = useAuthStore();
const canWrite = computed(() => lead.value && auth.canRecord('leads', 'edit', lead.value));
const lead = ref(null), loading = ref(false), error = ref(''), editing = ref(false), saving = ref(false);
const stages = ['New', 'Contacted', 'Qualified', 'Follow-up', 'Archived'];
const editTarget = ref(null);
const followUpAction = ref(null);
const channels = [{name:'Call',icon:'mdi-phone-outline'},{name:'WhatsApp',icon:'mdi-whatsapp'},{name:'Meeting',icon:'mdi-account-group-outline'},{name:'Email',icon:'mdi-email-outline'}];
const followUps = computed(() => lead.value?.followUps || []);
const count = channel => followUps.value.filter(f => f.channel === channel).length;
const contactFields = computed(() => [['Phone',lead.value?.phone],['Email',lead.value?.email],['Service',lead.value?.Service?.name],['Created',formatDate(lead.value?.created_at)]]);
const formatDate = date => date ? new Date(date).toLocaleString('en-GB', {dateStyle:'medium',timeStyle:'short'}) : '';
const reached = stage => {
  if (!lead.value) return false;
  if (stage === 'New') return true;
  if (stage === 'Archived') return lead.value.status === stage;
  const recorded = [lead.value.status, ...(lead.value.history || []).flatMap(entry => [entry.previous_status, entry.new_status])];
  if (stage === 'Contacted') return recorded.some(value => ['Contacted', 'Qualified'].includes(value)) || followUps.value.length > 0;
  if (stage === 'Follow-up') return recorded.includes(stage) || followUps.value.length > 0;
  return recorded.includes(stage);
};
const canMarkStage = stage => canWrite.value && lead.value?.status !== 'Archived' && (stage === 'Follow-up' ? lead.value.status !== stage : stage === 'Archived' || !reached(stage));
const milestoneDate = stage => {
  if (stage === 'Follow-up') return lead.value?.next_follow_up_date ? 'Scheduled · ' + lead.value.next_follow_up_date : followUps.value.length ? 'Last completed · ' + formatDate(followUps.value[0].occurred_at) : '';
  if (stage === 'New') return formatDate(lead.value?.created_at);
  const entry = [...(lead.value?.history || [])].reverse().find(h => h.new_status === stage);
  return entry ? formatDate(entry.created_at) : lead.value?.status === stage ? 'Current stage · date not recorded' : '';
};
const quotes=ref([]),quotesLoading=ref(false),quotesError=ref('');
const quoteAmount=value=>'AED '+Number(value || 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const quoteStatusColor=status=>({Draft:'grey',Sent:'info',Accepted:'success',Declined:'error',Expired:'warning'})[status];
const formatQuoteDate=value=>value?new Date(`${value}T00:00:00+04:00`).toLocaleDateString('en-GB',{timeZone:'Asia/Dubai',day:'numeric',month:'short',year:'numeric'}):'';
async function loadQuoteHistory(){
  quotes.value=[];quotesError.value='';
  if(!lead.value || !auth.can('quotations','read'))return;
  quotesLoading.value=true;
  try{quotes.value=(await $api.get('/quotations',{params:{lead_id:lead.value.id}})).data.data;}
  catch{quotesError.value='Unable to load quotation history.';}
  finally{quotesLoading.value=false;}
}
const downloadingAttachment=ref(null);
async function downloadAttachment(activity) {
  downloadingAttachment.value=activity.id;
  try {
    const {data}=await $api.get(`/leads/${lead.value.id}/follow-ups/${activity.id}/attachment`,{responseType:'blob'});
    const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download=activity.attachment_name;
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch { error.value='Unable to download attachment.'; }
  finally { downloadingAttachment.value=null; }
}
async function load() {
  loading.value = true; error.value = '';
  try { lead.value = (await $api.get(`/leads/${route.params.id}`)).data.data; await loadQuoteHistory(); }
  catch (e) { error.value = e.response?.data?.message || 'Unable to load lead'; }
  finally { loading.value = false; }
}
async function markStage(status) {
  if (!canMarkStage(status)) return;
  if (status === 'Archived') { editTarget.value = { ...lead.value, status: 'Archived', archive_reason: '' }; editing.value = true; return; }
  if (lead.value.status === 'Archived' && status === 'Follow-up') { editTarget.value = { ...lead.value, status: 'Follow-up' }; editing.value = true; return; }
  if (status === 'Follow-up') { followUpAction.value?.openSchedule(); return; }
  saving.value = true; error.value = '';
  try { await $api.put(`/leads/${lead.value.id}`, {status, update_source:'Details'}); await load(); }
  catch(e) { error.value = e.response?.data?.message || 'Unable to update milestone'; }
  finally { saving.value = false; }
}
onMounted(load);
</script>

<style scoped>
.detail-header { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.detail-grid { display:grid; grid-template-columns:minmax(0, 1fr) 330px; gap:24px; align-items:start; }
.main-column, aside { min-width:0; }
.history-sections { display:grid; grid-template-columns:minmax(0,65fr) minmax(0,35fr); gap:24px; align-items:start; }
@media(max-width:800px) { .history-sections { grid-template-columns:1fr; } }
.contact-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
dt { font-size:12px; opacity:.65; margin-bottom:5px; } dd { overflow-wrap:anywhere; }
.channel-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.channel-count { background:rgba(var(--v-theme-primary),.06); border-radius:20px; padding:18px 8px; display:flex; align-items:center; flex-direction:column; gap:5px; }
.channel-count strong { font-size:28px; } .channel-count span { font-size:13px; }
.activity { display:flex; gap:14px; padding:18px 0; border-bottom:1px solid rgba(var(--v-theme-on-surface),.07); }
.activity-body { flex:1; min-width:0; } .notes { white-space:pre-wrap; overflow-wrap:anywhere; }
.milestones { list-style:none; padding:0; } .milestones li { display:flex; gap:14px; position:relative; padding:0 0 24px; } .milestones li:not(:last-child)::after { content:''; position:absolute; left:11px; top:27px; bottom:4px; width:2px; background:rgba(var(--v-theme-primary),.13); } .current strong { color:rgb(var(--v-theme-primary)); }
.stage-history { font-size:12px; padding:10px 0; } .stage-history p { opacity:.65; }
.v-card { box-shadow:0 10px 35px rgba(0,0,0,.035) !important; }
@media(max-width:1050px) { .detail-grid { grid-template-columns:1fr; } }
@media(max-width:500px) { .channel-grid { grid-template-columns:repeat(2,1fr); } .contact-grid { grid-template-columns:1fr; } }
</style>
