<template>
  <section>
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div><h2 class="text-h5 font-weight-bold">Document Templates</h2><p class="text-medium-emphasis mt-2">Choose a fixed layout for each document. Company information comes from your workspace settings.</p></div>
      <v-spacer /><v-btn color="primary" rounded="pill" :loading="saving" :disabled="!auth.can('settings', 'write') || loading" @click="save">Save defaults</v-btn>
    </div>
    <v-alert v-if="message" :type="error ? 'error' : 'success'" class="mb-5" closable @click:close="message = ''">{{ message }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate class="mb-4" />
    <v-row>
      <v-col v-for="(title, type) in types" :key="type" cols="12" md="6">
        <v-card class="pa-5 rounded-xl" variant="flat">
          <h3 class="text-h6 mb-4">{{ title }}</h3>
          <div class="template-options">
            <button v-for="style in styles" :key="style" type="button" class="template-choice" :class="{ selected: defaults[type] === style }" :disabled="!auth.can('settings', 'write')" :aria-pressed="defaults[type] === style" @click="defaults[type] = style">
              <div class="paper" :class="style"><div class="paper-title" /><div class="paper-line" /><div class="paper-line short" /><div class="paper-table" /><div class="paper-line short total" /></div>
              <span>{{ style.charAt(0).toUpperCase() + style.slice(1) }}</span><v-icon v-if="defaults[type] === style" size="16" class="ml-1" color="primary">mdi-check-circle</v-icon>
            </button>
          </div>
          <v-btn class="mt-4" variant="tonal" rounded="pill" prepend-icon="mdi-eye-outline" :loading="previewing === type" @click="preview(type)">Preview {{ defaults[type] }}</v-btn>
        </v-card>
      </v-col>
    </v-row>
    <v-card class="pa-5 rounded-xl mt-6" variant="flat"><v-textarea v-model="footer" label="Document footer" hint="Saved with new documents. Maximum 1,200 characters." persistent-hint :maxlength="1200" counter :disabled="!auth.can('settings', 'write')" /><p class="text-caption mt-4">New documents remember their layout and footer. Older records keep their original PDF option and can also use these templates. Company information comes from current workspace settings.</p></v-card>
    <v-dialog v-model="previewOpen" max-width="960" @after-leave="clearPreview"><v-card class="rounded-xl"><v-card-title class="d-flex align-center">Template preview<v-spacer /><v-btn v-if="previewUrl" :href="previewUrl" download="template-preview.pdf" variant="text">Download sample</v-btn><v-btn aria-label="Close preview" icon="mdi-close" variant="text" @click="previewOpen = false" /></v-card-title><div class="pdf-preview"><v-progress-linear v-if="rendering" indeterminate /><canvas ref="previewCanvas" aria-label="Document template PDF preview" role="img" /></div></v-card></v-dialog>
  </section>
</template>
<script setup>
import { useAuthStore } from '@/stores/auth';
const auth = useAuthStore();
const { $api } = useNuxtApp();
const types = ref({}); const styles = ref([]); const defaults = ref({}); const footer = ref('');
const loading = ref(true); const saving = ref(false); const message = ref(''); const error = ref(false);
const previewing = ref(''); const previewOpen = ref(false); const previewUrl = ref('');
const previewCanvas = ref(null); const rendering = ref(false); let previewTask;
function fail(e) { error.value = true; message.value = e.response?.data?.message || 'Unable to complete request. Please try again.'; }
onMounted(async () => { try { const { data } = await $api.get('/document-templates'); types.value = data.types; styles.value = data.styles; defaults.value = Object.fromEntries(Object.keys(data.types).map(t => [t, data.settings.defaults?.[t] || 'classic'])); footer.value = data.settings.footer || ''; } catch (e) { fail(e); } finally { loading.value = false; } });
async function save() { saving.value = true; try { await $api.put('/document-templates/defaults', { defaults: defaults.value, footer: footer.value }); error.value = false; message.value = 'Document defaults saved for this workspace.'; } catch (e) { fail(e); } finally { saving.value = false; } }
function clearPreview() { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); previewUrl.value = ''; previewTask?.destroy(); previewTask = undefined; }
async function preview(type) {
  previewing.value = type;
  try {
    const { data } = await $api.get('/document-templates/preview', { params: { type, template: defaults.value[type] }, responseType: 'blob' });
    clearPreview(); previewUrl.value = URL.createObjectURL(data); rendering.value = true; previewOpen.value = true;
    const pdfjs = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    previewTask = pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()) });
    const pdf = await previewTask.promise; const page = await pdf.getPage(1); await nextTick();
    const canvas = previewCanvas.value;
    if (!canvas || !previewOpen.value) return;
    const viewport = page.getViewport({ scale: 1.5 }); canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  } catch (e) { previewOpen.value = false; fail(e); } finally { previewing.value = ''; rendering.value = false; }
}
onBeforeUnmount(clearPreview);
</script>
<style scoped>
.template-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.template-choice{padding:10px 6px;border:2px solid transparent;border-radius:18px;background:rgba(120,140,135,.06);color:inherit;cursor:pointer;font-size:12px}.template-choice.selected{border-color:rgb(var(--v-theme-primary));background:rgba(var(--v-theme-primary),.08)}.paper{height:100px;max-width:76px;margin:0 auto 10px;background:white;padding:12px 9px;box-shadow:0 5px 18px #26443814;border-radius:4px}.paper-title{height:6px;width:70%;background:#475569;margin-bottom:9px}.paper-line{height:3px;background:#cbd5e1;margin:5px 0}.short{width:60%}.paper-table{height:24px;margin-top:10px;background:repeating-linear-gradient(#e2e8f0 0 2px,transparent 2px 7px)}.total{margin-left:auto}.modern{border-top:5px solid #327565}.modern .paper-title{background:#327565}.compact{padding:8px}.compact .paper-table{height:37px}.minimal .paper-table{background:linear-gradient(#e2e8f0,#e2e8f0) top/100% 1px no-repeat}.minimal .paper-title{height:3px}.template-choice:focus-visible{outline:2px solid rgb(var(--v-theme-primary));outline-offset:3px}
.pdf-preview{height:75vh;overflow:auto;background:#e9edeb;padding:16px;text-align:center}.pdf-preview canvas{width:100%;max-width:794px;height:auto;background:white;box-shadow:0 5px 18px #26443814}
</style>
