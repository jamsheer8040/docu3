import { defineStore } from 'pinia';

function paymentOwner() {
  const user = JSON.parse(localStorage.getItem('auth_user') || 'null');
  if (!user?.id) throw new Error('Sign in again before making a salary payment.');
  return `salary-payment:${user.tenant_id || 'workspace'}:${user.id}`;
}
function stablePayment(value) {
  if (Array.isArray(value)) return value.map(stablePayment);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stablePayment(value[key])]));
  return value;
}
function newPaymentKey() {
  return globalThis.crypto.randomUUID?.() || Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
}
function salaryReadIdentity() {
  if (typeof localStorage === 'undefined') return '';
  const user=JSON.parse(localStorage.getItem('auth_user') || 'null');
  return JSON.stringify([user?.id,user?.tenant_id,user?.role,user?.role_type,user?.permissions]);
}

export const useSalaryStore = defineStore('salary', {
  state: () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const defaultMonth = `${yyyy}-${mm}`;

    return {
      currentMonth: defaultMonth,
      monthData: {
        isBooked: false,
        payroll: null,
        staffPreview: [],
        suggestedBookingDate: '',
        estimatedTotal: 0
      },
      summary: {
        operational: { total: 0, paid: 0, pending: 0 },
        salary: { total: 0, paid: 0, pending: 0 },
        combined: { total: 0, paid: 0, pending: 0 }
      },
      paymentHistory: [],
      historyLoading: false,
      historyError:null,
      historyItemId:null,
      historyRequestId:0,
      monthRequestId:0,
      summaryRequestId:0,
      loadedMonth:null,
      monthError:null,
      summaryError:null,
      summaryLoading:false,
      mutationLoading:false,
      salaryViewVersion: 0,
      paymentSubmitting: false,
      pendingPayment: null,
      paymentOwner: '',
      paymentRefreshWarning: '',
      loading: false,
      error: null
    };
  },

  getters: {
    monthReady:state=>state.loadedMonth===state.currentMonth && !state.loading && !state.monthError,
    isBooked: (state) => !!state.monthData?.isBooked,
    payroll: (state) => state.monthData?.payroll || null,
    items: (state) => state.monthData?.payroll?.Items || [],
    staffPreview: (state) => state.monthData?.staffPreview || [],
    monthTotals: (state) => {
      if (state.monthData?.isBooked && state.monthData?.payroll) {
        const p = state.monthData.payroll;
        const total = parseFloat(p.total_amount || 0);
        const paid = parseFloat(p.paid_amount || 0);
        const pending = Math.max(0, Math.round(total*100) - Math.round(paid*100))/100;
        const count = p.Items?.length || 0;
        return { total, paid, pending, count, status: p.status };
      }
      return {
        total: state.monthData?.estimatedTotal || 0,
        paid: 0,
        pending: state.monthData?.estimatedTotal || 0,
        count: state.monthData?.staffPreview?.length || 0,
        status: 'Not Booked'
      };
    }
  },

  actions: {
    clearSalaryView() {
      this.salaryViewVersion++;
      this.monthRequestId++;this.summaryRequestId++;this.loadedMonth=null;
      this.monthData={isBooked:false,payroll:null,staffPreview:[],suggestedBookingDate:'',estimatedTotal:0};
      this.summary={operational:{total:0,paid:0,pending:0},salary:{total:0,paid:0,pending:0},combined:{total:0,paid:0,pending:0}};
      this.clearPaymentHistory();this.error=null;this.monthError=null;this.loading=false;this.summaryError=null;this.summaryLoading=false;
      if(typeof localStorage!=='undefined'){
        try{this.restorePendingPayment();}catch{this.pendingPayment=null;this.paymentOwner='';}
      }
    },
    async fetchSummary(month = null) {
      const version=this.salaryViewVersion,identity=salaryReadIdentity(),request=++this.summaryRequestId;
      const targetMonth=month||this.currentMonth;
      const current=()=>version===this.salaryViewVersion && identity===salaryReadIdentity() && request===this.summaryRequestId && targetMonth===this.currentMonth;
      this.summary={operational:{total:0,paid:0,pending:0},salary:{total:0,paid:0,pending:0},combined:{total:0,paid:0,pending:0}};
      this.summaryError=null;this.summaryLoading=true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get('/salaries/summary', {
          params: { month: targetMonth }
        });
        if(!current())return;
        if(!response.data?.success)throw new Error('Unable to load salary summary.');
        this.summary = response.data.data;
      } catch (err) {
        if(current())this.summaryError=err.response?.data?.message||err.message||'Failed to load salary summary.';
      }finally{if(current())this.summaryLoading=false;}
    },

    async fetchMonthPayroll(month = null, { throwOnError = false } = {}) {
      if (month) this.currentMonth = month;
      const targetMonth=this.currentMonth,version=this.salaryViewVersion,identity=salaryReadIdentity(),request=++this.monthRequestId;
      const current=()=>version===this.salaryViewVersion && identity===salaryReadIdentity() && request===this.monthRequestId && targetMonth===this.currentMonth;
      this.loadedMonth=null;
      this.monthData={isBooked:false,payroll:null,staffPreview:[],suggestedBookingDate:'',estimatedTotal:0};
      this.clearPaymentHistory();
      this.summaryRequestId++;this.summaryLoading=false;this.summaryError=null;
      this.summary={operational:{total:0,paid:0,pending:0},salary:{total:0,paid:0,pending:0},combined:{total:0,paid:0,pending:0}};
      this.loading = true;
      this.error = null;
      this.monthError=null;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get(`/salaries/month/${targetMonth}`);
        if(!current())return;
        if (response.data?.success) {
          this.monthData = response.data;
          this.loadedMonth=targetMonth;
          this.paymentRefreshWarning = '';
        } else {
          throw new Error('Unable to refresh monthly payroll.');
        }
        await this.fetchSummary(targetMonth);
      } catch (err) {
        if(current()){
          this.error = err.response?.data?.message || err.message || 'Failed to fetch monthly payroll';
          this.monthError=this.error;
          if (throwOnError) throw err;
        }
      } finally {
        if(current())this.loading = false;
      }
    },

    async bookMonthSalary(payload) {
      if(!this.monthReady || this.mutationLoading)throw new Error('Load the selected payroll month before booking.');
      const targetMonth=this.currentMonth,identity=salaryReadIdentity();
      this.mutationLoading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.post('/salaries/book', {
          ...payload,month: targetMonth
        });
        if (response.data?.success) {
          if(identity===salaryReadIdentity()&&targetMonth===this.currentMonth){
            try{await this.fetchMonthPayroll(targetMonth,{throwOnError:true});}catch{return {...response.data,refreshFailed:true};}
          }
          return response.data;
        }
        throw new Error('Payroll booking was not confirmed.');
      } catch (err) {
        if(identity===salaryReadIdentity()&&targetMonth===this.currentMonth)this.error = err.response?.data?.message || 'Failed to book salary';
        throw err;
      } finally {
        this.mutationLoading = false;
      }
    },

    restorePendingPayment() {
      const owner = paymentOwner();
      if (this.paymentOwner !== owner) {
        this.paymentOwner = owner;
        this.paymentRefreshWarning = '';
        this.pendingPayment = null;
      }
      const saved = localStorage.getItem(owner);
      this.pendingPayment = saved ? JSON.parse(saved) : null;
      return this.pendingPayment;
    },
    async paySingleSalary(payload) { return this.transferSalary('single', payload); },
    async payBatchSalary(payload) { return this.transferSalary('batch', payload); },
    async retryPendingPayment() {
      const pending = this.restorePendingPayment();
      if (!pending) throw new Error('No salary transfer is awaiting confirmation.');
      return this.transferSalary(pending.kind, pending.payload);
    },
    async transferSalary(kind, payload) {
      if (this.paymentSubmitting) throw new Error('A salary transfer is already processing.');
      this.paymentSubmitting = true;
      let attempt, owner, started = false;
      try {
        this.restorePendingPayment();
        owner=this.paymentOwner;
        if (this.paymentRefreshWarning) throw new Error(this.paymentRefreshWarning);
        const body = JSON.parse(JSON.stringify(payload));
        attempt = this.pendingPayment;
        if (attempt && (attempt.kind !== kind || JSON.stringify(stablePayment(attempt.payload)) !== JSON.stringify(stablePayment(body)))) {
          throw new Error('Confirm the previous salary transfer using Retry before starting another.');
        }
        if (!attempt) {
          if(!this.monthReady || !this.isBooked || this.mutationLoading)throw new Error('Load the selected payroll month successfully before making a salary payment.');
          attempt = { kind, payload: body, key: newPaymentKey(), month: this.currentMonth, uncertain: false };
          // Persist before posting, so a lost response or page reload cannot
          // turn the same intended transfer into a new payment request.
          localStorage.setItem(owner, JSON.stringify(attempt));
          this.pendingPayment = attempt;
        }
        const { $api } = useNuxtApp();
        started = true;
        const response = await $api.post(`/salaries/pay-${kind}`, attempt.payload, { headers: { 'Idempotency-Key': attempt.key } });
        if (!response.data?.success) throw new Error('Salary payment confirmation was not received. Retry the original transfer.');
        localStorage.removeItem(owner);
        if(owner!==paymentOwner() || owner!==this.paymentOwner)return response.data;
        this.pendingPayment = null;
        try {
          await this.fetchMonthPayroll(this.currentMonth, { throwOnError: true });
        } catch {
          this.paymentRefreshWarning = 'Payment recorded successfully, but refreshing failed. Refresh payroll before making another payment.';
        }
        return response.data;
      } catch (err) {
        if (started && attempt) {
          const status = err.response?.status;
          if (!attempt.uncertain && [400, 403, 404, 422].includes(status)) {
            localStorage.removeItem(owner);
            if(this.paymentOwner===owner)this.pendingPayment = null;
          } else {
            attempt.uncertain = true;
            if(this.paymentOwner===owner)this.pendingPayment = attempt;
            localStorage.setItem(owner, JSON.stringify(attempt));
          }
        }
        if(!owner || this.paymentOwner===owner)this.error = err.response?.data?.message || err.message || 'Unable to confirm salary payment.';
        throw err;
      } finally { this.paymentSubmitting = false; }
    },

    async reverseSalaryPayment(paymentId,reason){
      if(!this.monthReady||this.mutationLoading||this.paymentSubmitting||this.pendingPayment)throw new Error('Load payroll and resolve any pending transfer before reversing a payment.');
      const identity=salaryReadIdentity(),month=this.currentMonth;
      this.mutationLoading=true;
      try{
        const {$api}=useNuxtApp();
        const response=await $api.post(`/salaries/payments/${paymentId}/reverse`,{reason});
        if(!response.data?.success)throw new Error('Salary reversal was not confirmed. Retry the same payment and reason.');
        if(identity===salaryReadIdentity()&&month===this.currentMonth){
          try{await this.fetchMonthPayroll(month,{throwOnError:true});}catch{return {...response.data,refreshFailed:true};}
        }
        return response.data;
      }catch(err){
        if(identity===salaryReadIdentity() && month===this.currentMonth && (!err.response?.status || err.response.status>=500)){
          this.clearSalaryView();this.monthError='Reversal confirmation was interrupted. Reload payroll and check payment history before retrying the same payment and reason.';this.error=this.monthError;
        }
        throw err;
      }finally{this.mutationLoading=false;}
    },

    async unbookMonthSalary(month = null) {
      const targetMonth = month || this.currentMonth;
      if(!this.monthReady || this.mutationLoading || targetMonth!==this.currentMonth)throw new Error('Load the selected payroll month before cancelling it.');
      const payrollId=String(this.payroll?.id||'');
      if(!/^[1-9]\d{0,19}$/.test(payrollId))throw new Error('Reload the selected payroll before cancelling it.');
      const identity=salaryReadIdentity();
      this.mutationLoading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.delete(`/salaries/month/${targetMonth}`,{params:{payroll_id:payrollId}});
        if (response.data?.success) {
          if(identity===salaryReadIdentity()&&targetMonth===this.currentMonth){
            try{await this.fetchMonthPayroll(targetMonth,{throwOnError:true});}catch{return {...response.data,refreshFailed:true};}
          }
          return response.data;
        }
        throw new Error('Payroll cancellation was not confirmed.');
      } catch (err) {
        if(identity===salaryReadIdentity()&&targetMonth===this.currentMonth){
          const message=err.response?.data?.message||'Cancellation confirmation was interrupted. Reload payroll and review the current record before cancelling again.';
          if(!err.response?.status||[404,409].includes(err.response.status)||err.response.status>=500){this.clearSalaryView();this.monthError=message;}
          this.error=message;
        }
        throw err;
      } finally {
        this.mutationLoading = false;
      }
    },

    clearPaymentHistory(){
      this.historyRequestId++;this.paymentHistory=[];this.historyError=null;this.historyLoading=false;this.historyItemId=null;
    },
    async fetchPaymentHistory(salaryItemId) {
      const version=this.salaryViewVersion,identity=salaryReadIdentity(),request=++this.historyRequestId;
      this.paymentHistory=[];this.historyError=null;this.historyItemId=salaryItemId;
      const current=()=>version===this.salaryViewVersion && identity===salaryReadIdentity() && request===this.historyRequestId;
      this.historyLoading = true;
      try {
        const { $api } = useNuxtApp();
        const response = await $api.get(`/salaries/items/${salaryItemId}/payments`);
        if(!current())return;
        if (response.data?.success) {
          this.paymentHistory = response.data.data;
          return response.data.data;
        }else throw new Error('Unable to load payment history.');
      } catch (err) {
        if(current())this.historyError=err.response?.data?.message||err.message||'Failed to load payment history.';
      } finally {
        if(current())this.historyLoading = false;
      }
    }
  }
});
