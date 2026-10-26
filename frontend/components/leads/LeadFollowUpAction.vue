<template>
  <div class="follow-up-actions d-flex ga-2 flex-wrap align-center" @click.stop>
    <v-btn v-if="pending" class="follow-up-progress" :title="`Follow-up progress: ${Math.round(progress)}%`" :disabled="!canWrite" :color="due ? 'error' : 'primary'" :variant="due ? 'flat' : 'tonal'" :size="compact ? 'small' : 'default'" prepend-icon="mdi-calendar-clock" @click="openLog">
      <svg class="follow-up-progress-border" aria-hidden="true"><rect x="1.5" y="1.5" :rx="compact ? 14 : 18" pathLength="100" :stroke-dasharray="`${progress} 100`" /></svg>
      {{ due ? 'Fo-Due' : 'Follow-up' }} · {{ lead.next_follow_up_date }}
    </v-btn>
    <v-btn v-else-if="canWrite" color="primary" variant="tonal" :size="compact ? 'small' : 'default'" prepend-icon="mdi-calendar-plus" @click="openSchedule">Schedule follow-up</v-btn>
    <v-btn v-if="pending && canWrite" variant="text" :size="compact ? 'small' : 'default'" aria-label="Reschedule follow-up" icon="mdi-calendar-edit" @click="openSchedule" />
    <v-btn v-if="canWrite && !compact && !pending" color="primary" variant="text" prepend-icon="mdi-plus" @click="openLog">Log follow-up</v-btn>
    <v-dialog v-model="scheduling" max-width="450"><v-card rounded="xl" class="pa-6"><h2 class="text-h5 mb-4">{{ pending ? 'Reschedule follow-up' : 'Schedule follow-up' }}</h2><v-form @submit.prevent="saveSchedule"><v-text-field v-model="scheduleDate" :label="pending ? 'New follow-up date' : 'Follow-up date'" type="date" variant="outlined" /><v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert><div class="d-flex justify-end ga-2"><v-btn variant="text" :disabled="saving" @click="scheduling=false">Cancel</v-btn><v-btn color="primary" type="submit" :loading="saving">{{ pending ? 'Update follow-up date' : 'Save follow-up date' }}</v-btn></div></v-form></v-card></v-dialog>
    <v-dialog v-model="logging" max-width="560"><v-card rounded="xl" class="pa-6"><h2 class="text-h5 mb-4">Log completed follow-up</h2><v-alert v-if="completedDate" variant="tonal" color="primary" class="mb-5">Completes the follow-up scheduled for {{ completedDate }}.</v-alert><v-form @submit.prevent="saveLog"><v-select v-model="form.channel" label="Channel" :items="['Call','WhatsApp','Meeting','Email']" variant="outlined" /><v-text-field v-model="form.date" label="Date and time" type="datetime-local" variant="outlined" /><v-textarea v-model="form.notes" label="Conversation notes / outcome" maxlength="5000" counter="5000" variant="outlined" /><v-file-input v-model="attachment" label="Attachment (optional)" accept=".pdf,.jpg,.jpeg,.png,.webp" prepend-icon="" prepend-inner-icon="mdi-paperclip" variant="outlined" show-size clearable hint="PDF, JPG, PNG or WEBP · up to 10 MB" persistent-hint class="mb-4" /><v-text-field v-model="form.nextDate" label="Next follow-up date (optional)" type="date" variant="outlined" persistent-hint :hint="completedDate ? 'Leave blank to return the lead to Qualified.' : 'Choose a date to put this lead on Follow-up.'" /><v-alert v-if="error" type="error" variant="tonal" class="my-4">{{ error }}</v-alert><div class="d-flex justify-end ga-2 mt-5"><v-btn variant="text" :disabled="saving" @click="logging=false">Cancel</v-btn><v-btn color="primary" type="submit" :loading="saving">Save follow-up</v-btn></div></v-form></v-card></v-dialog>
  </div>
</template>
<script setup>
import { useAuthStore } from '~/stores/auth';
import { followUpProgress } from '~/utils/followUpProgress';
const props = defineProps({lead:{type:Object,required:true},compact:Boolean});
const emit = defineEmits(['saved']);
const { $api } = useNuxtApp();
const auth = useAuthStore();
const canWrite = computed(()=>props.lead.status !== 'Archived' && auth.canRecord('leads','edit',props.lead));
const today = ref('');
const refreshDay = () => { today.value = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); };
let timer;
onMounted(()=>{refreshDay();timer=setInterval(refreshDay,30000);});
onBeforeUnmount(()=>clearInterval(timer));
const pending = computed(()=>props.lead.status==='Follow-up' && !!props.lead.next_follow_up_date);
const due = computed(()=>pending.value && today.value && props.lead.next_follow_up_date <= today.value);
const progress = computed(()=>followUpProgress(props.lead, today.value));
const scheduling=ref(false), logging=ref(false), saving=ref(false), error=ref(''), scheduleDate=ref(''), completedDate=ref(null);
const attachment=ref(null);
const form=reactive({channel:'Call',date:'',notes:'',nextDate:''});
function openSchedule() { if(!canWrite.value)return; scheduleDate.value=props.lead.next_follow_up_date || today.value;error.value='';scheduling.value=true; }
function openLog() {
  if(!canWrite.value)return;
  const now=new Date();form.date=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  attachment.value=null;form.channel='Call';form.notes='';form.nextDate='';completedDate.value=pending.value?props.lead.next_follow_up_date:null;error.value='';logging.value=true;
}
async function saveSchedule() {
  if(!scheduleDate.value){error.value='Choose a follow-up date.';return;}
  saving.value=true;error.value='';
  try { await $api.put(`/leads/${props.lead.id}`,{status:'Follow-up',next_follow_up_date:scheduleDate.value,update_source:'Details'});scheduling.value=false;emit('saved'); }
  catch(e){error.value=e.response?.data?.message || 'Unable to save the date';}
  finally{saving.value=false;}
}
async function saveLog() {
  const date=new Date(form.date);
  if(!form.notes.trim() || !Number.isFinite(date.getTime()) || date>new Date()){error.value='Enter notes and a past or current date.';return;}
  saving.value=true;error.value='';
  try {
    const file=Array.isArray(attachment.value)?attachment.value[0]:attachment.value;
    if(file && file.size>10*1024*1024){error.value='Attachment must be under 10 MB.';return;}
    const payload=new FormData();
    payload.append('channel',form.channel);payload.append('occurred_at',date.toISOString());payload.append('notes',form.notes);
    if(completedDate.value)payload.append('complete_scheduled_date',completedDate.value);
    if(form.nextDate)payload.append('next_follow_up_date',form.nextDate);
    if(file)payload.append('attachment',file);
    await $api.post(`/leads/${props.lead.id}/follow-ups`,payload);logging.value=false;emit('saved');
  }
  catch(e){error.value=e.response?.data?.message || 'Unable to save follow-up';}
  finally{saving.value=false;}
}
defineExpose({openSchedule,openLog});
</script>
<style scoped>
.follow-up-progress { position:relative; }
.follow-up-progress-border { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
.follow-up-progress-border rect { width:calc(100% - 3px); height:calc(100% - 3px); fill:none; stroke:#ef4444; stroke-width:2; stroke-linecap:round; }
</style>
