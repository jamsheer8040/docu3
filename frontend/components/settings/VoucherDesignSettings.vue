<template>
  <v-card flat class="pa-4 bg-grey-lighten-4">
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h2 class="text-h5 font-weight-bold text-slate-800">Voucher Design Templates</h2>
        <div class="text-caption text-grey-darken-1">Customize printable layouts, branding, columns, and prefix formats for all business vouchers.</div>
      </div>
      <div class="d-flex align-center gap-2">
        <v-btn-toggle v-model="currentTab" mandatory color="primary" variant="outlined" density="comfortable" class="mr-2 bg-white">
          <v-btn value="design" prepend-icon="mdi-pencil-ruler">Templates</v-btn>
          <v-btn value="audit" prepend-icon="mdi-history">Audit Log</v-btn>
        </v-btn-toggle>
        <v-btn v-if="currentTab === 'design' && mode === 'list'" color="primary" prepend-icon="mdi-plus" @click="openCreateDialog" class="font-weight-bold text-none rounded-lg">
          New Template
        </v-btn>
        <v-btn v-if="currentTab === 'design' && mode === 'edit'" color="grey-darken-2" variant="outlined" prepend-icon="mdi-arrow-left" @click="backToList" class="font-weight-bold text-none rounded-lg bg-white">
          Back to List
        </v-btn>
      </div>
    </div>

    <!-- Templates List View -->
    <v-card v-if="currentTab === 'design' && mode === 'list'" border flat class="rounded-xl bg-white mb-4">
      <v-data-table
        :key="tableKey"
        :headers="templateHeaders"
        :items="allTemplates"
        hover
      >
        <template v-slot:item.is_default="{ item }">
          <v-chip v-if="item.is_default" color="success" size="small" class="font-weight-bold">DEFAULT</v-chip>
        </template>
        <template v-slot:item.actions="{ item }">
          <v-btn size="small" variant="text" color="primary" icon="mdi-pencil" @click="editTemplate(item)" title="Manage Design"></v-btn>
          <v-btn size="small" variant="text" color="success" icon="mdi-check-decagram" :disabled="item.is_default" @click="makeDefaultList(item)" title="Set as Default"></v-btn>
          <v-btn size="small" variant="text" color="error" icon="mdi-delete" :disabled="item.is_default" @click="deleteTemplateList(item)" title="Delete"></v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- Main Workspace (Edit View) -->
    <div v-if="currentTab === 'design' && mode === 'edit' && activeTemplate">
      <div class="mb-4 d-flex align-center gap-3">
        <h3 class="text-h6 font-weight-bold">Editing: {{ activeTemplate.name }} ({{ activeTemplate.voucher_type }})</h3>
        <v-chip v-if="activeTemplate.is_default" color="success" size="small" class="font-weight-bold">DEFAULT</v-chip>
        <v-spacer></v-spacer>
        <v-btn v-if="!activeTemplate.is_default" color="success" variant="outlined" prepend-icon="mdi-check-decagram" @click="makeDefault" class="font-weight-bold text-none rounded-lg bg-white">Set Default</v-btn>
      </div>
      <v-row>
      <!-- 1. Design Controls Panel -->
      <v-col cols="12" lg="6">
        <v-card border flat class="rounded-xl px-4 py-3 bg-white elevation-1">
          <div class="d-flex justify-space-between align-center border-b pb-3 mb-4">
            <span class="text-subtitle-1 font-weight-bold text-slate-800">Configuration Options</span>
            <v-btn color="primary" class="font-weight-bold text-none rounded-lg" prepend-icon="mdi-content-save" @click="saveChanges" :loading="saving">
              Save Changes
            </v-btn>
          </div>

          <v-expansion-panels variant="accordion" class="custom-panels">
            <!-- Branding & Colors -->
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title class="font-weight-bold">
                <v-icon icon="mdi-palette-outline" class="mr-2" color="primary"></v-icon>Branding & Layout
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pt-2">
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="activeTemplate.layout"
                      :items="layoutOptions"
                      label="Paper Layout Size"
                      density="compact"
                      variant="outlined"
                    ></v-select>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="activeTemplate.language"
                      :items="['English']"
                      label="Document Language"
                      density="compact"
                      variant="outlined"
                      readonly
                    ></v-select>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="activeTemplate.branding_config.primaryColor"
                      label="Primary Color Hex"
                      type="color"
                      density="compact"
                      variant="outlined"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="activeTemplate.branding_config.secondaryColor"
                      label="Secondary Color Hex"
                      type="color"
                      density="compact"
                      variant="outlined"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="activeTemplate.branding_config.fontFamily"
                      :items="['Inter', 'Outfit', 'Roboto', 'Arial', 'Courier New']"
                      label="Font Family"
                      density="compact"
                      variant="outlined"
                    ></v-select>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="activeTemplate.branding_config.fontSize"
                      label="Font Size (px)"
                      type="number"
                      density="compact"
                      variant="outlined"
                    ></v-text-field>
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Number Format & Sequences -->
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title class="font-weight-bold">
                <v-icon icon="mdi-numeric" class="mr-2" color="indigo"></v-icon>Number Sequence Format
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pt-2">
                <v-row>
                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model="activeTemplate.number_format.prefix"
                      label="Prefix Code"
                      placeholder="INV-"
                      density="compact"
                      variant="outlined"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-checkbox
                      v-model="activeTemplate.number_format.includeYear"
                      label="Include Year"
                      density="compact"
                      hide-details
                    ></v-checkbox>
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model.number="activeTemplate.number_format.startingNumber"
                      label="Starting Sequence"
                      type="number"
                      density="compact"
                      variant="outlined"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="activeTemplate.number_format.length"
                      label="Running Number Padding"
                      type="number"
                      density="compact"
                      variant="outlined"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="6" class="d-flex align-center">
                    <span class="text-caption text-grey-darken-1 font-weight-bold">
                      Format Preview: <code class="bg-grey-lighten-3 pa-1 text-primary">{{ formatNumberPreview() }}</code>
                    </span>
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Header Section Settings -->
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title class="font-weight-bold">
                <v-icon icon="mdi-page-layout-header" class="mr-2" color="teal"></v-icon>Document Header Details
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pt-2">
                <v-row>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.header_config.showLogo" label="Company Logo" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.header_config.showCompanyName" label="Company Name" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.header_config.showAddress" label="Address Block" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.header_config.showPhone" label="Phone Details" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.header_config.showEmail" label="Email Address" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.header_config.showWebsite" label="Company Website" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4" v-if="vatEnabled">
                    <v-checkbox v-model="activeTemplate.header_config.showTaxNumber" label="TRN / VAT No" density="compact" hide-details disabled></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.header_config.showQRCode" label="Header QR Code" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model="activeTemplate.header_config.headerBgColor"
                      label="Header BG Hex"
                      type="color"
                      density="compact"
                      variant="outlined"
                    ></v-text-field>
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Document Metadata Info Fields -->
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title class="font-weight-bold">
                <v-icon icon="mdi-file-document-edit-outline" class="mr-2" color="amber-darken-3"></v-icon>Document Details & Client Info
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pt-2">
                <v-row>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showVoucherNumber" label="Voucher No." density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showCustomerName" label="Customer Name" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showCustomerCode" label="Customer Code" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showContactPerson" label="Contact Person" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showMobile" label="Contact Mobile" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showEmail" label="Contact Email" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showCustomerAddress" label="Customer Address" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showReferenceNumber" label="Reference No." density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showDate" label="Document Date" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showDueDate" label="Due Date" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.info_config.showSalesExecutive" label="Sales Executive" density="compact" hide-details></v-checkbox>
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Table Columns Customization -->
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title class="font-weight-bold">
                <v-icon icon="mdi-table-cog" class="mr-2" color="green-darken-1"></v-icon>Service / Item Table Columns
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pt-2">
                <div class="text-caption text-grey-darken-2 mb-2 font-weight-bold">Choose visible columns and reorder them:</div>
                <v-list density="compact" class="border rounded-lg bg-grey-lighten-5">
                  <template v-for="(col, index) in activeTemplate.table_config" :key="col.key">
                    <v-list-item v-if="col.key !== 'vat' || vatEnabled" class="border-bottom">
                    <div class="d-flex align-center justify-space-between w-100">
                      <v-checkbox
                        v-model="col.visible"
                        :label="col.label"
                        density="compact"
                        hide-details
                        class="mt-0"
                      ></v-checkbox>
                      <div class="d-flex align-center gap-1">
                        <v-btn icon="mdi-chevron-up" density="comfortable" variant="text" size="small" :disabled="index === 0" @click="moveColumn(index, -1)"></v-btn>
                        <v-btn icon="mdi-chevron-down" density="comfortable" variant="text" size="small" :disabled="index === activeTemplate.table_config.length - 1" @click="moveColumn(index, 1)"></v-btn>
                      </div>
                    </div>
                    </v-list-item>
                  </template>
                </v-list>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Totals & Balances -->
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title class="font-weight-bold">
                <v-icon icon="mdi-calculator-variant-outline" class="mr-2" color="deep-purple-lighten-1"></v-icon>Calculation Totals Columns
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pt-2">
                <v-row>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.totals_config.showSubtotal" label="Sub Total" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.totals_config.showDiscount" label="Discount" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4" v-if="vatEnabled">
                    <v-checkbox v-model="activeTemplate.totals_config.showVAT" label="VAT / Tax" density="compact" hide-details disabled></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.totals_config.showGovernmentFees" label="Gov. Fees" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.totals_config.showServiceCharges" label="Service Charges" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.totals_config.showGrandTotal" label="Grand Total" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.totals_config.showAmountPaid" label="Amount Paid" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6" md="4">
                    <v-checkbox v-model="activeTemplate.totals_config.showBalanceDue" label="Balance Due" density="compact" hide-details></v-checkbox>
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Document Footer Details -->
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title class="font-weight-bold">
                <v-icon icon="mdi-page-layout-footer" class="mr-2" color="blue-darken-2"></v-icon>Document Footer & Declarations
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pt-2">
                <v-textarea
                  v-model="activeTemplate.footer_config.termsConditions"
                  label="Terms & Conditions Text"
                  density="compact"
                  variant="outlined"
                  rows="2"
                ></v-textarea>
                <v-textarea
                  v-model="activeTemplate.footer_config.bankDetails"
                  label="Bank Details Info"
                  density="compact"
                  variant="outlined"
                  rows="2"
                ></v-textarea>
                <v-row>
                  <v-col cols="6">
                    <v-checkbox v-model="activeTemplate.footer_config.showPreparedBy" label="Prepared By" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6">
                    <v-checkbox v-model="activeTemplate.footer_config.showApprovedBy" label="Approved By" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6">
                    <v-checkbox v-model="activeTemplate.footer_config.showCompanySeal" label="Company Seal Box" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6">
                    <v-checkbox v-model="activeTemplate.footer_config.showCustomerSignature" label="Client Signature Line" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="12">
                    <v-checkbox v-model="activeTemplate.footer_config.showAuthorizedSignatory" label="Authorized Signatory Signature Box" density="compact" hide-details></v-checkbox>
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>

            <!-- Printable Page Properties -->
            <v-expansion-panel elevation="0">
              <v-expansion-panel-title class="font-weight-bold">
                <v-icon icon="mdi-printer" class="mr-2" color="blue-grey-darken-1"></v-icon>Print Options
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pt-2">
                <v-row>
                  <v-col cols="6">
                    <v-checkbox v-model="activeTemplate.print_config.showPageNumbers" label="Show Page Numbers" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="6">
                    <v-checkbox v-model="activeTemplate.print_config.showWatermark" label="Enable Watermark" density="compact" hide-details></v-checkbox>
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="activeTemplate.print_config.watermarkText"
                      label="Watermark Overlay Text"
                      density="compact"
                      variant="outlined"
                      :disabled="!activeTemplate.print_config.showWatermark"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12">
                    <v-checkbox v-model="activeTemplate.print_config.printDuplicate" label="Always overlay 'DUPLICATE COPY' watermark" density="compact" hide-details></v-checkbox>
                  </v-col>
                </v-row>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card>
      </v-col>

      <!-- 2. Live Document Preview Pane -->
      <v-col cols="12" lg="6">
        <div class="preview-container">
          <div class="d-flex justify-space-between align-center mb-2 px-1">
            <span class="text-subtitle-2 font-weight-bold text-slate-700">Live Print Preview Mockup</span>
            <div class="d-flex gap-1">
              <v-btn size="small" variant="text" prepend-icon="mdi-printer-eye" color="primary" class="font-weight-bold" @click="testPrint">Print Test</v-btn>
              <v-btn size="small" variant="text" prepend-icon="mdi-download" color="primary" class="font-weight-bold" @click="downloadSample">Download PDF</v-btn>
            </div>
          </div>

          <!-- Printable Sheet Wrapper -->
          <v-card flat class="preview-sheet mx-auto elevation-4 d-flex flex-column pa-6 bg-white" :style="getBrandingStyles()">
            <!-- Document Header -->
            <div class="preview-header d-flex justify-space-between pb-4 mb-4 border-b-2 pa-4" :style="{ borderBottomColor: activeTemplate.branding_config.primaryColor, backgroundColor: activeTemplate.header_config.headerBgColor || 'transparent' }">
              <div>
                <div v-if="activeTemplate.header_config.showLogo" class="preview-logo-placeholder mb-2 d-flex align-center justify-center font-weight-black">
                  LOGO
                </div>
                <div v-if="activeTemplate.header_config.showCompanyName" class="text-h6 font-weight-black lh-tight font-custom">
                  Your Corporation LLC
                </div>
                <div class="text-grey-darken-2 mt-1" style="font-size: 0.9em;">
                  <div v-if="activeTemplate.header_config.showAddress">123 Business Avenue, Downtown Dubai, UAE</div>
                  <div v-if="activeTemplate.header_config.showPhone">Phone: +971 4 123 4567</div>
                  <div v-if="activeTemplate.header_config.showEmail">Email: contact@corporation.com</div>
                  <div v-if="activeTemplate.header_config.showWebsite">Web: www.corporation.com</div>
                  <div v-if="activeTemplate.header_config.showTaxNumber" class="font-weight-bold mt-1">TRN: 100234567890003</div>
                </div>
              </div>
              <div class="text-right d-flex flex-column align-end">
                <div class="text-h5 font-weight-bold text-uppercase tracking-wider font-custom" :style="{ color: activeTemplate.branding_config.primaryColor }">
                  {{ vatEnabled ? 'TAX ' + selectedVoucherType : selectedVoucherType }}
                </div>
                <div v-if="activeTemplate.header_config.showQRCode" class="preview-qr-placeholder mt-2 d-flex align-center justify-center">
                  <v-icon icon="mdi-qrcode" size="48" color="grey-darken-1"></v-icon>
                </div>
              </div>
            </div>

            <!-- Client / Meta Details -->
            <v-row class="mb-4 text-grey-darken-3" style="font-size: 0.95em;">
              <v-col cols="7">
                <div class="font-weight-bold mb-1 text-slate-800" style="font-size: 1.1em;">CLIENT DETAILS:</div>
                <div v-if="activeTemplate.info_config.showCustomerName"><span class="text-grey-darken-1">Client:</span> Bhai Bhai Grocery SPS LLC</div>
                <div v-if="activeTemplate.info_config.showCustomerCode"><span class="text-grey-darken-1">Client Code:</span> CUST-8834</div>
                <div v-if="activeTemplate.info_config.showContactPerson"><span class="text-grey-darken-1">Contact:</span> Emran H.</div>
                <div v-if="activeTemplate.info_config.showMobile"><span class="text-grey-darken-1">Phone:</span> +971 50 123 4567</div>
                <div v-if="activeTemplate.info_config.showEmail"><span class="text-grey-darken-1">Email:</span> emran@bhaibhaigrocery.com</div>
                <div v-if="activeTemplate.info_config.showCustomerAddress"><span class="text-grey-darken-1">Address:</span> Al Rolla Road, Sharjah, UAE</div>
              </v-col>
              <v-col cols="5" class="text-right">
                <div class="font-weight-bold mb-1 text-slate-800" style="font-size: 1.1em;">DETAILS:</div>
                <div v-if="activeTemplate.info_config.showVoucherNumber"><span class="text-grey-darken-1">Voucher No:</span> {{ formatNumberPreview() }}</div>
                <div v-if="activeTemplate.info_config.showDate"><span class="text-grey-darken-1">Date:</span> 18/07/2026</div>
                <div v-if="activeTemplate.info_config.showDueDate"><span class="text-grey-darken-1">Due Date:</span> 25/07/2026</div>
                <div v-if="activeTemplate.info_config.showReferenceNumber"><span class="text-grey-darken-1">Ref:</span> SO-REF-8284</div>
                <div v-if="activeTemplate.info_config.showSalesExecutive"><span class="text-grey-darken-1">Sales Rep:</span> Jamsheer K.</div>
              </v-col>
            </v-row>

            <!-- Table -->
            <div class="flex-grow-1 mb-4" style="overflow: hidden;">
              <table class="w-100 preview-table" style="font-size: 0.95em;">
                <thead>
                  <tr :style="{ backgroundColor: activeTemplate.branding_config.secondaryColor + '15' }">
                    <th v-for="(col, index) in visibleColumns" :key="col.key" class="pa-2 font-weight-bold text-slate-800" 
                        :class="index === visibleColumns.length - 1 ? 'text-right' : 'text-left'"
                        :style="{ borderBottom: '2px solid ' + activeTemplate.branding_config.primaryColor }">
                      {{ col.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="n in 2" :key="n" :style="{ borderBottom: '1px solid ' + activeTemplate.branding_config.secondaryColor + '20' }">
                    <td v-for="(col, index) in visibleColumns" :key="col.key" class="pa-2 py-3 text-grey-darken-3"
                        :class="index === visibleColumns.length - 1 ? 'text-right' : 'text-left'">
                      <template v-if="col.key === 'name'">{{ n === 1 ? 'Emirates ID Renewal' : 'Labor Card Insurance' }}</template>
                      <template v-if="col.key === 'description'">{{ n === 1 ? 'Standard processing' : '2-year coverage' }}</template>
                      <template v-if="col.key === 'quantity'">1</template>
                      <template v-if="col.key === 'unitPrice'">{{ n === 1 ? 'AED 350.00' : 'AED 189.00' }}</template>
                      <template v-if="col.key === 'discount'">AED 0.00</template>
                      <template v-if="col.key === 'vat'">5%</template>
                      <template v-if="col.key === 'total'">{{ n === 1 ? 'AED 367.50' : 'AED 187.95' }}</template>
                      <template v-if="col.key === 'remarks'">-</template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Calculation Columns -->
            <div class="d-flex justify-space-between mb-4" style="font-size: 0.95em;">
              <div style="width: 50%;">
                <div v-if="activeTemplate.footer_config.bankDetails" class="pa-2 border rounded-lg bg-grey-lighten-5 mb-2" style="font-size: 0.85em;">
                  <strong>BANK INSTRUCTIONS:</strong><br/>
                  {{ activeTemplate.footer_config.bankDetails }}
                </div>
              </div>
              <div style="width: 45%;">
                <table class="w-100 text-right">
                  <tr v-if="activeTemplate.totals_config.showSubtotal">
                    <td class="text-grey-darken-1">Subtotal:</td>
                    <td class="font-weight-bold">AED 539.00</td>
                  </tr>
                  <tr v-if="activeTemplate.totals_config.showDiscount" class="text-error">
                    <td>Discount:</td>
                    <td>-AED 10.00</td>
                  </tr>
                  <tr v-if="activeTemplate.totals_config.showVAT">
                    <td class="text-grey-darken-1">VAT (5%):</td>
                    <td class="font-weight-bold">AED 26.45</td>
                  </tr>
                  <tr v-if="activeTemplate.totals_config.showGovernmentFees">
                    <td class="text-grey-darken-1">Government Fees:</td>
                    <td>AED 0.00</td>
                  </tr>
                  <tr v-if="activeTemplate.totals_config.showServiceCharges">
                    <td class="text-grey-darken-1">Service Charges:</td>
                    <td>AED 0.00</td>
                  </tr>
                  <tr v-if="activeTemplate.totals_config.showGrandTotal" class="border-top text-subtitle-2 font-weight-black" :style="{ color: activeTemplate.branding_config.primaryColor }">
                    <td class="pt-1">GRAND TOTAL:</td>
                    <td class="pt-1">AED 555.45</td>
                  </tr>
                  <tr v-if="activeTemplate.totals_config.showAmountPaid" class="text-success">
                    <td>Amount Paid:</td>
                    <td class="font-weight-bold">AED 555.45</td>
                  </tr>
                  <tr v-if="activeTemplate.totals_config.showBalanceDue" class="border-top-2 font-weight-black">
                    <td class="pt-1">BALANCE DUE:</td>
                    <td class="pt-1">AED 0.00</td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Watermark text if enabled -->
            <div v-if="activeTemplate.print_config.showWatermark" class="preview-watermark-overlay d-flex align-center justify-center">
              {{ activeTemplate.print_config.watermarkText || 'SAMPLE' }}
            </div>
            <div v-if="activeTemplate.print_config.printDuplicate" class="preview-duplicate-overlay">
              DUPLICATE COPY
            </div>

            <!-- Footer Signatures -->
            <div class="mt-auto pt-4 border-t-2" :style="{ borderTopColor: activeTemplate.branding_config.primaryColor + '40' }">
              <div v-if="activeTemplate.footer_config.termsConditions" class="text-grey-darken-2 mb-4" style="font-size: 0.75em; line-height: 1.2;">
                <strong>TERMS & CONDITIONS:</strong> {{ activeTemplate.footer_config.termsConditions }}
              </div>
              <div class="d-flex justify-space-between align-end text-center font-weight-bold" style="font-size: 0.85em;">
                <div v-if="activeTemplate.footer_config.showPreparedBy" style="width: 25%;">
                  <div class="border-bottom mb-1" style="height: 30px;"></div>
                  <span>Prepared By</span>
                </div>
                <div v-if="activeTemplate.footer_config.showApprovedBy" style="width: 25%;">
                  <div class="border-bottom mb-1" style="height: 30px;"></div>
                  <span>Approved By</span>
                </div>
                <div v-if="activeTemplate.footer_config.showCustomerSignature" style="width: 25%;">
                  <div class="border-bottom mb-1" style="height: 30px;"></div>
                  <span>Customer Signature</span>
                </div>
                <div v-if="activeTemplate.footer_config.showAuthorizedSignatory" style="width: 25%;">
                  <div class="border-bottom mb-1" style="height: 30px; position: relative;">
                    <div v-if="activeTemplate.footer_config.showCompanySeal" class="preview-seal-placeholder">SEAL</div>
                  </div>
                  <span>Authorized Signatory</span>
                </div>
              </div>
            </div>
          </v-card>
        </div>
      </v-col>
    </v-row>
    </div>

    <!-- 3. Audit Logs Panel -->
    <v-card v-else-if="currentTab === 'audit'" border flat class="rounded-xl pa-4 bg-white elevation-1">
      <div class="text-subtitle-1 font-weight-bold mb-4 text-slate-800 border-b pb-2">Voucher Design Alteration Audit Trail</div>
      <v-table hover>
        <thead>
          <tr class="bg-grey-lighten-4">
            <th class="font-weight-bold text-slate-700">Timestamp</th>
            <th class="font-weight-bold text-slate-700">User</th>
            <th class="font-weight-bold text-slate-700">Voucher Type</th>
            <th class="font-weight-bold text-slate-700">Template</th>
            <th class="font-weight-bold text-slate-700">Action</th>
            <th class="font-weight-bold text-slate-700 text-end">Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in auditLogs" :key="log.id">
            <td>{{ formatDateTime(log.created_at) }}</td>
            <td>
              <div class="font-weight-bold">{{ log.User?.name || 'Admin System' }}</div>
              <div class="text-caption text-grey">{{ log.User?.email || '' }}</div>
            </td>
            <td>
              <v-chip size="x-small" color="primary" class="font-weight-bold">{{ log.voucher_type }}</v-chip>
            </td>
            <td>{{ log.template_name }}</td>
            <td>
              <v-chip size="x-small" :color="getActionColor(log.action)" class="font-weight-bold text-uppercase">{{ log.action }}</v-chip>
            </td>
            <td class="text-end">
              <v-btn size="small" variant="text" prepend-icon="mdi-eye-outline" color="primary" @click="viewAuditDetail(log)">
                Inspect Changes
              </v-btn>
            </td>
          </tr>
          <tr v-if="!auditLogs.length">
            <td colspan="6" class="text-center pa-4 text-secondary opacity-60">No modifications logged yet.</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- Create Template Dialog -->
    <v-dialog v-model="createDialog" max-width="500px">
      <v-card class="rounded-xl pa-4">
        <v-card-title class="text-h6 font-weight-bold border-b pb-2 mb-4">
          Create Design Template Variant
        </v-card-title>
        <v-card-text class="pa-0">
          <v-form ref="createForm" v-model="formValid">
            <v-text-field
              v-model="newTemplateName"
              label="Template Name"
              placeholder="e.g. Standard, Minimalist, Corporate Red"
              density="comfortable"
              variant="outlined"
              :rules="[v => !!v || 'Name is required']"
              class="mb-3"
            ></v-text-field>

            <v-select
              v-model="newVoucherType"
              :items="voucherTypes"
              label="Applies to Voucher Type"
              density="comfortable"
              variant="outlined"
              :rules="[v => !!v || 'Voucher type is required']"
              class="mb-3"
            ></v-select>

            <v-select
              v-model="cloneFromTemplateId"
              :items="allTemplates"
              item-title="name"
              item-value="id"
              label="Clone settings from existing (optional)"
              density="comfortable"
              variant="outlined"
              clearable
              class="mb-3"
            ></v-select>
          </v-form>
        </v-card-text>
        <v-card-actions class="px-0 pt-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="createDialog = false" class="font-weight-bold text-none">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!formValid" @click="submitCreateTemplate" class="font-weight-bold text-none rounded-lg px-4" :loading="creating">
            Create Template
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Audit Details Dialog -->
    <v-dialog v-model="logDetailDialog" max-width="700px">
      <v-card class="rounded-xl pa-4">
        <v-card-title class="text-h6 font-weight-bold border-b pb-2 mb-4">
          Configuration Delta Details
        </v-card-title>
        <v-card-text class="pa-0">
          <div class="text-caption text-grey mb-3">Compare changed configuration JSON below:</div>
          <v-row>
            <v-col cols="6">
              <div class="font-weight-bold mb-1 text-error">PREVIOUS CONFIGURATION</div>
              <pre class="bg-grey-lighten-4 pa-2 border rounded-lg text-caption custom-pre">{{ JSON.stringify(selectedLog?.previous_values, null, 2) || '(None)' }}</pre>
            </v-col>
            <v-col cols="6">
              <div class="font-weight-bold mb-1 text-success">NEW CONFIGURATION</div>
              <pre class="bg-grey-lighten-4 pa-2 border rounded-lg text-caption custom-pre">{{ JSON.stringify(selectedLog?.new_values, null, 2) || '(Deleted)' }}</pre>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="px-0 pt-4">
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="flat" @click="logDetailDialog = false" class="font-weight-bold text-none rounded-lg">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useNuxtApp } from '#app'
import { useUIStore } from '~/stores/ui'
import { useConfigStore } from '~/stores/config'

const { $api } = useNuxtApp()
const uiStore = useUIStore()
const configStore = useConfigStore()



// Component States
const currentTab = ref('design')
const mode = ref('list')
const selectedVoucherType = ref('Invoice')
const selectedTemplateId = ref(null)
const allTemplates = ref([])
const auditLogs = ref([])
const tableKey = ref(0)

const templateHeaders = [
  { title: 'Template Name', key: 'name', sortable: true },
  { title: 'Voucher Type', key: 'voucher_type', sortable: true },
  { title: 'Status', key: 'is_default', sortable: false },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false }
]

// Dialog States
const createDialog = ref(false)
const newTemplateName = ref('')
const newVoucherType = ref('Invoice')
const cloneFromTemplateId = ref(null)
const formValid = ref(false)
const createForm = ref(null)
const creating = ref(false)
const saving = ref(false)

// Audit Log Inspection
const logDetailDialog = ref(false)
const selectedLog = ref(null)

const voucherTypes = ['Invoice', 'Sales Order', 'Quotation', 'Payment Receipt', 'Expense Voucher']
const layoutOptions = ['A4 Portrait', 'A4 Landscape', 'Thermal Receipt (80mm)', 'Half A4']

// Default Config Initializers
const getDefaultConfigs = () => ({
  header_config: {
    showLogo: true,
    showCompanyName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showWebsite: true,
    showTaxNumber: true,
    showQRCode: true,
    headerBgColor: '#ffffff'
  },
  info_config: {
    showVoucherNumber: true,
    showCustomerName: true,
    showCustomerCode: false,
    showContactPerson: true,
    showMobile: true,
    showEmail: false,
    showCustomerAddress: true,
    showReferenceNumber: true,
    showDate: true,
    showDueDate: true,
    showSalesExecutive: true
  },
  table_config: [
    { key: 'name', label: 'Service / Item', visible: true },
    { key: 'description', label: 'Description', visible: true },
    { key: 'quantity', label: 'Qty', visible: true },
    { key: 'unitPrice', label: 'Price', visible: true },
    { key: 'discount', label: 'Discount', visible: true },
    { key: 'vat', label: 'VAT', visible: true },
    { key: 'total', label: 'Total', visible: true },
    { key: 'remarks', label: 'Remarks', visible: false }
  ],
  totals_config: {
    showSubtotal: true,
    showDiscount: true,
    showVAT: true,
    showGovernmentFees: false,
    showServiceCharges: false,
    showGrandTotal: true,
    showAmountPaid: true,
    showBalanceDue: true
  },
  footer_config: {
    termsConditions: 'All fees are non-refundable. Payment is due within 7 days.',
    bankDetails: 'Bank: Emirates NBD\nIBAN: AE030240000001234567890\nBIC: ENB DAEAA',
    showPreparedBy: true,
    showApprovedBy: true,
    showCompanySeal: true,
    showCustomerSignature: true,
    showAuthorizedSignatory: true
  },
  branding_config: {
    primaryColor: '#0054a6',
    secondaryColor: '#4f5e71',
    fontFamily: 'Inter',
    fontSize: 12
  },
  print_config: {
    showPageNumbers: true,
    showWatermark: false,
    watermarkText: 'SAMPLE',
    printDuplicate: false
  },
  number_format: {
    prefix: 'INV-',
    includeYear: true,
    startingNumber: 1,
    length: 6
  }
})

// Loaded active template
const activeTemplate = ref(null)

// VAT Configuration Lock
const vatEnabled = computed(() => configStore.settings?.is_vat_enabled === 'true' || configStore.settings?.is_vat_enabled === true)

// Use specific watch to prevent infinite reactivity loops
watch([vatEnabled, () => activeTemplate.value?.id], ([isVatEnabled]) => {
  if (activeTemplate.value) {
    // Ensure VAT config keys exist in old templates
    if (activeTemplate.value.header_config && activeTemplate.value.header_config.showTaxNumber === undefined) {
      activeTemplate.value.header_config.showTaxNumber = false
    }
    if (activeTemplate.value.totals_config && activeTemplate.value.totals_config.showVAT === undefined) {
      activeTemplate.value.totals_config.showVAT = false
    }
    
    if (activeTemplate.value.table_config) {
      let vatTableCol = activeTemplate.value.table_config.find(c => c.key === 'vat')
      // Inject the VAT column if it's missing entirely (backward compatibility)
      if (!vatTableCol) {
        vatTableCol = { key: 'vat', label: 'VAT', visible: false }
        // Insert it right before "total" or at the end
        const totalIdx = activeTemplate.value.table_config.findIndex(c => c.key === 'total')
        if (totalIdx !== -1) {
          activeTemplate.value.table_config.splice(totalIdx, 0, vatTableCol)
        } else {
          activeTemplate.value.table_config.push(vatTableCol)
        }
      }
      
      if (isVatEnabled) {
        if (activeTemplate.value.header_config) activeTemplate.value.header_config.showTaxNumber = true
        if (activeTemplate.value.totals_config) activeTemplate.value.totals_config.showVAT = true
        vatTableCol.visible = true
      } else {
        if (activeTemplate.value.header_config) activeTemplate.value.header_config.showTaxNumber = false
        if (activeTemplate.value.totals_config) activeTemplate.value.totals_config.showVAT = false
        vatTableCol.visible = false
      }
    }
  }
}, { immediate: true })

const filteredTemplates = computed(() => {
  return allTemplates.value.filter(t => t.voucher_type === selectedVoucherType.value)
})

const visibleColumns = computed(() => {
  if (!activeTemplate.value || !activeTemplate.value.table_config) return []
  return activeTemplate.value.table_config.filter(c => c.visible)
})

// Load templates from API
const loadTemplates = async () => {
  try {
    const res = await $api.get('/voucher-designs')
    if (res.data && res.data.success) {
      allTemplates.value = res.data.data
      
      // Update active template if in edit mode
      if (mode.value === 'edit' && activeTemplate.value) {
        onTemplateChange(activeTemplate.value.id)
      }
    }
  } catch (error) {
    console.error('Error loading templates:', error)
  }
}

const editTemplate = (item) => {
  onTemplateChange(item.id)
  mode.value = 'edit'
}

const backToList = () => {
  activeTemplate.value = null
  selectedTemplateId.value = null
  mode.value = 'list'
}

// Load logs from API
const loadAuditLogs = async () => {
  try {
    const res = await $api.get('/voucher-designs/audit-logs')
    if (res.data && res.data.success) {
      auditLogs.value = res.data.data
    }
  } catch (error) {
    console.error('Error loading audit logs:', error)
  }
}

// Handle template switch
const onTemplateChange = (id) => {
  if (!id) return
  const found = allTemplates.value.find(t => t.id === id)
  if (found) {
    // Clone deep to avoid mutating local cache state directly
    activeTemplate.value = JSON.parse(JSON.stringify(found))
  }
}

// Reorder table columns
const moveColumn = (index, direction) => {
  if (!activeTemplate.value || !activeTemplate.value.table_config) return
  const list = activeTemplate.value.table_config
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= list.length) return
  
  // Swap
  const temp = list[index]
  list[index] = list[targetIndex]
  list[targetIndex] = temp
}

// Formats the numbering code preview string
const formatNumberPreview = () => {
  if (!activeTemplate.value || !activeTemplate.value.number_format) return ''
  const fmt = activeTemplate.value.number_format
  const yearPart = fmt.includeYear ? `${new Date().getFullYear()}-` : ''
  const numPart = String(fmt.startingNumber).padStart(fmt.length || 6, '0')
  return `${fmt.prefix || ''}${yearPart}${numPart}`
}

// inline styling options for mockup pane
const getBrandingStyles = () => {
  if (!activeTemplate.value || !activeTemplate.value.branding_config) return {}
  const brand = activeTemplate.value.branding_config
  
  let layoutStyles = {}
  if (activeTemplate.value.layout === 'Half A4') {
    layoutStyles = {
      minHeight: '421px',
      maxHeight: '421px'
    }
  } else if (activeTemplate.value.layout === 'A4 Landscape') {
    layoutStyles = {
      maxWidth: '842px',
      minHeight: '595px',
      maxHeight: '595px'
    }
  } else {
    // Default A4 Portrait
    layoutStyles = {
      maxWidth: '595px',
      minHeight: '842px',
      maxHeight: '842px'
    }
  }

  let direction = 'ltr'
  if (activeTemplate.value.language === 'Arabic') {
    direction = 'rtl'
  }

  return {
    fontFamily: `${brand.fontFamily}, sans-serif !important`,
    fontSize: `${brand.fontSize}px`,
    direction: direction,
    ...layoutStyles
  }
}

// Save config alterations
const saveChanges = async () => {
  if (!activeTemplate.value) return
  saving.value = true
  try {
    const res = await $api.put(`/voucher-designs/${activeTemplate.value.id}`, activeTemplate.value)
    if (res.data && res.data.success) {
      uiStore.showSnackbar({ text: 'Voucher design updated successfully', color: 'success' })
      await loadTemplates()
      await loadAuditLogs()
    }
  } catch (error) {
    console.error('Error saving changes:', error)
    uiStore.showSnackbar({ text: 'Failed to save layout changes', color: 'error' })
  } finally {
    saving.value = false
  }
}

// Mark default trigger
const makeDefault = async () => {
  if (!activeTemplate.value) return
  try {
    const res = await $api.put(`/voucher-designs/${activeTemplate.value.id}/default`)
    if (res.data && res.data.success) {
      uiStore.showSnackbar({ text: res.data.message, color: 'success' })
      await loadTemplates()
      await loadAuditLogs()
    }
  } catch (error) {
    console.error('Error setting default:', error)
  }
}

// Shared helper to refresh the data table after any mutation
const refreshTable = async () => {
  try {
    const res = await $api.get('/voucher-designs')
    if (res.data && res.data.success) {
      allTemplates.value = res.data.data
      tableKey.value = Date.now()
      await nextTick()
    }
  } catch (e) {
    console.error('Error refreshing templates:', e)
  }
}

// Delete design template (from edit view)
const deleteTemplate = async () => {
  if (!activeTemplate.value) return
  if (!window.confirm(`Are you sure you want to delete template "${activeTemplate.value.name}"?`)) return
  try {
    const res = await $api.delete(`/voucher-designs/${activeTemplate.value.id}`)
    if (res.data && res.data.success) {
      uiStore.showSnackbar({ text: res.data.message, color: 'success' })
      backToList()
      await refreshTable()
      loadAuditLogs().catch(() => {})
    }
  } catch (error) {
    console.error('Error deleting template:', error)
    uiStore.showSnackbar({ text: error.message || 'Failed to delete template', color: 'error' })
  }
}

const makeDefaultList = async (item) => {
  if (!item) return
  try {
    const res = await $api.put(`/voucher-designs/${item.id}/default`)
    if (res.data && res.data.success) {
      uiStore.showSnackbar({ text: res.data.message, color: 'success' })
      await refreshTable()
      loadAuditLogs().catch(() => {})
    }
  } catch (error) {
    console.error('Error setting default:', error)
  }
}

// Delete design template (from list view)
const deleteTemplateList = async (item) => {
  if (!item) return
  if (!window.confirm(`Are you sure you want to delete template "${item.name}"?`)) return
  try {
    const delId = item.id
    const res = await $api.delete(`/voucher-designs/${delId}`)
    if (res.data && res.data.success) {
      uiStore.showSnackbar({ text: res.data.message, color: 'success' })
      await refreshTable()
      loadAuditLogs().catch(() => {})
    }
  } catch (error) {
    console.error('Error deleting template:', error)
    uiStore.showSnackbar({ text: error.message || 'Failed to delete template', color: 'error' })
  }
}

// Dialog copy functions
const openCreateDialog = () => {
  newTemplateName.value = ''
  newVoucherType.value = selectedVoucherType.value
  cloneFromTemplateId.value = selectedTemplateId.value
  createDialog.value = true
}

const submitCreateTemplate = async () => {
  creating.value = true
  try {
    let payload = getDefaultConfigs()
    payload.name = newTemplateName.value
    payload.voucher_type = newVoucherType.value

    if (cloneFromTemplateId.value) {
      const parent = allTemplates.value.find(t => t.id === cloneFromTemplateId.value)
      if (parent) {
        payload.language = parent.language
        payload.layout = parent.layout
        payload.header_config = JSON.parse(JSON.stringify(parent.header_config))
        payload.info_config = JSON.parse(JSON.stringify(parent.info_config))
        payload.table_config = JSON.parse(JSON.stringify(parent.table_config))
        payload.totals_config = JSON.parse(JSON.stringify(parent.totals_config))
        payload.footer_config = JSON.parse(JSON.stringify(parent.footer_config))
        payload.branding_config = JSON.parse(JSON.stringify(parent.branding_config))
        payload.print_config = JSON.parse(JSON.stringify(parent.print_config))
        payload.number_format = JSON.parse(JSON.stringify(parent.number_format))
      }
    }

    const res = await $api.post('/voucher-designs', payload)
    if (res.data && res.data.success) {
      // 1. Close dialog and stop spinner immediately
      createDialog.value = false
      creating.value = false

      // 2. Refresh the table with fresh data from server
      await refreshTable()

      uiStore.showSnackbar({ text: 'Template variant created successfully', color: 'success' })

      // 3. Stay on list view so user sees the new template
      mode.value = 'list'

      // 4. Audit logs in background
      loadAuditLogs().catch(() => {})
    } else {
      uiStore.showSnackbar({ text: 'Failed to create template', color: 'error' })
    }
  } catch (error) {
    console.error('Error creating template:', error)
    uiStore.showSnackbar({ text: error.message || 'Failed to create template variant', color: 'error' })
  } finally {
    creating.value = false
    createDialog.value = false
  }
}

// Mock print tests
const testPrint = () => {
  window.print()
}

const downloadSample = () => {
  alert('Sample PDF layout downloaded successfully.')
}

// UI Formatting helpers
const formatDateTime = (val) => {
  if (!val) return ''
  return new Date(val).toLocaleString()
}

const getActionColor = (action) => {
  const map = { CREATE: 'success', UPDATE: 'info', DELETE: 'error', SET_DEFAULT: 'primary' }
  return map[action] || 'grey'
}

const viewAuditDetail = (log) => {
  selectedLog.value = log
  logDetailDialog.value = true
}


// Load initialization data
onMounted(async () => {
  await loadTemplates()
  await loadAuditLogs()
})
</script>

<style scoped>
.preview-container {
  position: sticky;
  top: 10px;
}
.preview-sheet {
  width: 100%;
  border: 1px solid rgba(0,0,0,0.1) !important;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}
.preview-sheet,
.preview-sheet * {
  font-family: inherit !important;
}
.font-custom {
  font-family: inherit !important;
}
.preview-logo-placeholder {
  width: 60px;
  height: 40px;
  background-color: #f1f5f9;
  border: 2px dashed #94a3b8;
  color: #94a3b8;
  border-radius: 4px;
  font-size: 10px;
}
.preview-qr-placeholder {
  width: 64px;
  height: 64px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}
.preview-table {
  width: 100%;
  border-collapse: collapse;
}
.preview-table th {
  padding: 6px;
  text-align: left;
}
.preview-table td {
  padding: 6px;
  border-bottom: 1px solid #f1f5f9;
}
.border-b-2 {
  border-bottom-width: 2px;
  border-bottom-style: solid;
}
.border-t-2 {
  border-top-width: 2px;
  border-top-style: solid;
}
.border-top-2 {
  border-top: 2px solid #334155 !important;
}
.lh-tight {
  line-height: 1.1;
}
.preview-watermark-overlay {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 72px;
  font-weight: 900;
  color: rgba(15, 23, 42, 0.04);
  pointer-events: none;
  white-space: nowrap;
  user-select: none;
}
.preview-duplicate-overlay {
  position: absolute;
  top: 15px;
  right: 15px;
  font-size: 10px;
  font-weight: 800;
  color: rgba(220, 38, 38, 0.4);
  border: 2px solid rgba(220, 38, 38, 0.4);
  padding: 2px 6px;
  transform: rotate(5deg);
  pointer-events: none;
  user-select: none;
}
.preview-seal-placeholder {
  width: 48px;
  height: 48px;
  border: 2px dashed rgba(220, 38, 38, 0.4);
  border-radius: 50%;
  color: rgba(220, 38, 38, 0.4);
  font-size: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: -10px;
  right: 10px;
}
.custom-panels :deep(.v-expansion-panel) {
  margin-bottom: 8px !important;
  border: 1px solid #f1f5f9 !important;
  border-radius: 8px !important;
  overflow: hidden;
}
.custom-pre {
  max-height: 350px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
