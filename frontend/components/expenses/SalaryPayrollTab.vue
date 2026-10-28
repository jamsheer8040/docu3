<template>
  <div>
    <v-alert v-if="salaryStore.monthError" type="error" variant="tonal" class="mb-4">
      {{ salaryStore.monthError }}
      <div class="mt-2"><v-btn size="small" :loading="salaryStore.loading" @click="reloadMonth">Retry loading payroll</v-btn></div>
    </v-alert>
    <v-alert v-if="salaryStore.summaryError" type="warning" variant="tonal" class="mb-4">
      Summary unavailable: {{ salaryStore.summaryError }}
      <v-btn size="small" variant="text" :loading="salaryStore.summaryLoading" @click="salaryStore.fetchSummary()">Retry summary</v-btn>
    </v-alert>
    <v-progress-linear v-if="salaryStore.loading" indeterminate color="primary" class="mb-4" aria-label="Loading payroll" />
    <v-alert v-if="salaryStore.pendingPayment" type="warning" variant="tonal" class="mb-4">
      A {{ salaryStore.pendingPayment.kind === 'batch' ? 'batch salary transfer' : 'salary payment' }} for {{ salaryStore.pendingPayment.month }} is awaiting confirmation. Retry to confirm the original transfer before starting another.
      <div class="mt-3"><v-btn size="small" color="warning" :loading="salaryStore.paymentSubmitting" :disabled="submitting" @click="retrySalaryPayment">Retry original transfer</v-btn></div>
    </v-alert>
    <v-alert v-if="salaryStore.paymentRefreshWarning" type="warning" variant="tonal" class="mb-4">
      {{ salaryStore.paymentRefreshWarning }}
      <div class="mt-3"><v-btn size="small" :loading="salaryStore.loading" @click="reloadMonth">Refresh payroll</v-btn></div>
    </v-alert>
    <!-- Top Month Control & Navigation Bar -->
    <v-card class="pa-4 soft-card mb-6" variant="flat" rounded="xl">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <!-- Month Navigator -->
        <div class="d-flex align-center gap-3">
          <v-btn
            icon="mdi-chevron-left"
            variant="tonal"
            color="primary"
            size="small"
            rounded="lg"
            :disabled="salaryStore.loading || salaryStore.mutationLoading || submitting"
            @click="changeMonth(-1)"
          ></v-btn>

          <div class="d-flex align-center gap-2">
            <v-icon color="primary" size="20">mdi-calendar-month</v-icon>
            <span class="text-h6 font-weight-black color-primary" style="min-width: 170px;">
              {{ formattedMonthName }}
            </span>
          </div>

          <v-btn
            icon="mdi-chevron-right"
            variant="tonal"
            color="primary"
            size="small"
            rounded="lg"
            :disabled="salaryStore.loading || salaryStore.mutationLoading || submitting"
            @click="changeMonth(1)"
          ></v-btn>

          <v-btn
            v-if="!isCurrentMonth"
            variant="text"
            color="primary"
            size="small"
            class="text-caption font-weight-bold text-capitalize"
            @click="jumpToCurrentMonth"
            :disabled="salaryStore.mutationLoading || submitting"
          >
            Current Month
          </v-btn>

          <!-- Status Chip -->
          <v-chip
            size="small"
            rounded="pill"
            class="font-weight-bold px-3 ml-2"
            :color="statusColor"
            variant="tonal"
          >
            {{ salaryStore.monthTotals.status }}
          </v-chip>
        </div>

        <!-- Month Action Buttons -->
        <div class="d-flex align-center gap-3">


          <v-btn
            v-if="salaryStore.monthReady && salaryStore.isBooked && salaryStore.monthTotals.paid === 0 && !hasPaymentHistory && canSalary('delete')"
            :disabled="submitting || salaryStore.paymentSubmitting || !!salaryStore.pendingPayment"
            variant="outlined"
            color="error"
            prepend-icon="mdi-delete-sweep-outline"
            rounded="lg"
            height="42"
            class="px-4 font-weight-bold text-capitalize bg-white"
            :loading="salaryStore.mutationLoading"
            @click="confirmUnbook"
          >
            Unbook Month
          </v-btn>

          <v-btn
            variant="outlined"
            color="grey-darken-1"
            icon="mdi-refresh"
            size="small"
            rounded="lg"
            :loading="salaryStore.loading"
            @click="reloadMonth"
            :disabled="salaryStore.mutationLoading || submitting"
          ></v-btn>
        </div>
      </div>
    </v-card>

    <v-alert v-if="salaryStore.isBooked && !salaryStore.payroll?.expense_id" type="info" variant="tonal" density="compact" class="mb-4">
      This historical payroll has no linked salary expense. Existing accounting is unchanged; review any manually recorded salary expense before making an adjustment.
    </v-alert>
    <v-alert v-if="salaryStore.isBooked && salaryStore.monthTotals.paid === 0 && hasPaymentHistory" type="info" variant="tonal" density="compact" class="mb-4">
      This payroll retains payment history and cannot be unbooked. Reversed payments can be paid again through the normal Pay action.
    </v-alert>

    <!-- Month Metric KPI Cards -->
    <v-row v-if="salaryStore.monthReady" class="mb-6">
      <!-- Total Month Payroll -->
      <v-col cols="12" sm="4">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(79, 66, 148, 0.1); color: #4F4294; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-account-cash</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">
              {{ salaryStore.isBooked ? 'Booked salary' : 'Estimated salary' }}
            </div>
            <div class="text-h5 font-weight-black color-primary mb-1">
              AED {{ (salaryStore.isBooked ? salaryStore.monthTotals.total : bookingComputedTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-medium text-grey-darken-1">
              {{ salaryStore.monthTotals.count }} staff member{{ salaryStore.monthTotals.count === 1 ? '' : 's' }}
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Paid -->
      <v-col v-if="salaryStore.isBooked" cols="12" sm="4">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(46, 125, 50, 0.1); color: #2E7D32; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-check-decagram-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Paid</div>
            <div class="text-h5 font-weight-black text-success mb-1">
              AED {{ salaryStore.monthTotals.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-bold text-success">
              {{ paidPercentage }}% paid
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Remaining Pending -->
      <v-col v-if="salaryStore.isBooked" cols="12" sm="4">
        <v-card class="pa-5 soft-card d-flex align-center gap-4" height="100%" variant="flat" rounded="xl">
          <div class="pa-3 rounded-xl d-flex align-center justify-center" style="background: rgba(198, 40, 40, 0.1); color: #C62828; min-width: 48px; height: 48px;">
            <v-icon size="default">mdi-clock-alert-outline</v-icon>
          </div>
          <div>
            <div class="text-caption font-weight-bold opacity-60 text-uppercase mb-1">Balance</div>
            <div class="text-h5 font-weight-black text-error mb-1">
              AED {{ salaryStore.monthTotals.pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <div class="text-caption font-weight-bold text-error">
              {{ salaryStore.monthTotals.pending > 0 ? 'Outstanding salary' : 'Fully paid' }}
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- CASE 1: NOT BOOKED STATE - CLEAN DIRECT SALARY BOOKING SHEET (NO BOX OVERLOAD) -->
    <v-card v-if="salaryStore.monthReady && !salaryStore.isBooked" class="soft-card pa-6" variant="flat" rounded="xl">
      <!-- Clean Top Info Bar (Zero Form Box Clutter) -->
      <div class="d-flex align-center justify-space-between flex-wrap ga-4 py-3 px-5 bg-grey-lighten-4 rounded-xl mb-4 border" style="gap: 16px;">
        <div class="d-flex align-center flex-wrap ga-5" style="gap: 20px;">
          <div class="px-1">
            <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Payroll Month</div>
            <div class="text-subtitle-1 font-weight-black text-primary d-flex align-center">
              <v-icon size="20" color="primary" class="mr-2">mdi-calendar-month</v-icon>
              {{ formattedMonthName }}
            </div>
          </div>

          <v-divider vertical class="mx-3 my-1" style="height: 36px; align-self: center;"></v-divider>

          <div class="px-1">
            <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Calculation Basis</div>
            <div class="text-subtitle-1 font-weight-bold d-flex align-center">
              <v-icon size="18" color="grey-darken-2" class="mr-2">mdi-calculator-variant</v-icon>
              {{ daysInCurrentMonth }} Calendar Days
            </div>
          </div>

          <v-divider vertical class="mx-3 my-1" style="height: 36px; align-self: center;"></v-divider>

          <div class="px-1">
            <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mb-1">Booking date</div>
            <div class="d-flex align-center">
              <v-icon size="18" color="primary" class="mr-2">mdi-calendar-check</v-icon>
              <input
                type="date"
                v-model="bookingForm.booking_date"
                :disabled="!canSalary('create') || submitting"
                class="clean-date-input font-weight-bold text-body-2"
              />
            </div>
          </div>
        </div>

        <div class="d-flex align-center gap-3">
          <v-chip variant="flat" color="primary" class="font-weight-bold px-3">
            {{ bookingForm.items.length }} Staff
          </v-chip>

        </div>
      </div>

      <div class="d-flex align-center justify-space-between mb-3 px-1 flex-wrap gap-2">
        <div class="text-caption text-grey-darken-1 d-flex align-center gap-1">
          <v-icon size="16" color="primary">mdi-information-outline</v-icon>
          Booking records the monthly salary expense once. Pay later in one or multiple instalments, up to the remaining balance. Default unpaid leave is 0 days.
        </div>
        <div class="text-caption font-weight-bold text-grey">
          Daily Rate = Monthly Salary &divide; {{ daysInCurrentMonth }} Days
        </div>
      </div>

      <!-- Clean Staff Table (Zero Form Box Clutter) -->
      <div class="border rounded-xl mb-4 overflow-hidden bg-white">
        <v-table density="comfortable" hover>
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold" style="min-width: 250px;">STAFF MEMBER</th>
              <th class="text-right font-weight-bold" style="min-width: 180px;">MONTHLY SALARY BASIS (AED)</th>
              <th class="text-center font-weight-bold" style="min-width: 140px;">PER-DAY RATE</th>
              <th class="text-center font-weight-bold" style="min-width: 210px;">UNPAID LEAVE</th>
              <th class="text-right font-weight-bold" style="min-width: 160px;">LEAVE DEDUCTION</th>
              <th class="text-right font-weight-bold" style="min-width: 190px;">NET AMOUNT (AED)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="staff in bookingForm.items" :key="staff.user_id" class="hover-bg-grey">
              <!-- Staff Info -->
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <v-avatar size="36" color="primary" variant="tonal">
                    <v-img v-if="staff.avatar" :src="staff.avatar"></v-img>
                    <span v-else class="text-caption font-weight-bold">{{ staff.name?.charAt(0) || 'U' }}</span>
                  </v-avatar>
                  <div>
                    <div class="font-weight-bold text-body-2">{{ staff.name }}</div>
                    <div class="text-caption text-grey-darken-1">{{ staff.designation || 'Staff' }}</div>
                  </div>
                </div>
              </td>

              <!-- Base Monthly Salary (Clean text with optional edit) -->
              <td class="text-right">
                <div v-if="!staff.editingSalary" class="d-flex align-center justify-end gap-1">
                  <span class="font-weight-bold text-body-2">
                    AED {{ (staff.base_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </span>
                  <v-btn
                    v-if="canSalary('create')"
                    icon="mdi-pencil-outline"
                    size="x-small"
                    variant="text"
                    color="grey"
                    density="compact"
                    title="Edit base salary"
                    @click="staff.editingSalary = true"
                  ></v-btn>
                </div>
                <div v-else class="d-flex align-center justify-end gap-1">
                  <input
                    v-model.number="staff.base_salary"
                    :readonly="!canSalary('create')"
                    type="number"
                    min="0"
                    step="0.01"
                    class="clean-mini-input text-right font-weight-bold"
                    @keyup.enter="saveSalaryEdit(staff)"
                  />
                  <v-btn
                    icon="mdi-check"
                    size="x-small"
                    color="success"
                    variant="flat"
                    density="compact"
                    @click="saveSalaryEdit(staff)"
                  ></v-btn>
                </div>
                <v-text-field v-if="staff.editingSalary || hasSalaryOverride(staff) || staff.override_reason" v-model="staff.override_reason" :readonly="!canSalary('create')" label="Override reason" placeholder="Why is this salary different?" variant="underlined" density="compact" maxlength="2000" :error="hasSalaryOverride(staff) && !staff.override_reason?.trim()" hide-details="auto" class="mt-2" />
                <div v-if="staff.calculationError" class="text-caption text-error">{{ staff.calculationError }}</div>
              </td>

              <!-- Per-Day Rate -->
              <td class="text-center">
                <span class="text-caption font-weight-bold text-grey-darken-2">
                  AED {{ (staff.daily_rate || 0).toFixed(2) }}/d
                </span>
              </td>

              <!-- Leave Days (Unpaid) - Clean Stepper Pill -->
              <td class="text-center">
                <div class="d-flex align-center justify-center gap-1">
                  <v-btn
                    v-if="canSalary('create') && staff.leave_days > 0"
                    icon="mdi-minus"
                    size="x-small"
                    variant="tonal"
                    color="grey-darken-2"
                    density="compact"
                    title="Subtract 1 day"
                    @click="decrementLeave(staff)"
                  ></v-btn>

                  <v-chip
                    size="small"
                    :color="staff.leave_days > 0 ? 'error' : 'default'"
                    :variant="staff.leave_days > 0 ? 'flat' : 'tonal'"
                    class="font-weight-bold cursor-pointer px-3"
                    @click="promptEditLeave(staff)"
                    :title="canSalary('create') ? 'Click to enter exact leave days' : 'Unpaid leave days'"
                  >
                    <v-icon start size="14" v-if="staff.leave_days > 0">mdi-calendar-remove</v-icon>
                    {{ staff.leave_days > 0 ? `${staff.leave_days} Day${staff.leave_days === 1 ? '' : 's'}` : 'No Leave' }}
                  </v-chip>

                  <v-btn
                    icon="mdi-plus"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    density="compact"
                    title="Add 1 unpaid leave day"
                    v-if="canSalary('create')"
                    @click="incrementLeave(staff)"
                  ></v-btn>

                </div>
              </td>

              <!-- Leave Deduction Amount -->
              <td class="text-right">
                <span v-if="staff.leave_deduction > 0" class="text-error font-weight-bold text-body-2">
                  -AED {{ (staff.leave_deduction || 0).toFixed(2) }}
                </span>
                <span v-else class="text-caption text-grey-lighten-1">
                  —
                </span>
              </td>

              <!-- Final Payable Amount -->
              <td class="text-right font-weight-black text-body-1 color-primary">
                AED {{ (staff.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
            </tr>

            <tr v-if="bookingForm.items.length === 0">
              <td colspan="6" class="text-center py-6 text-grey">
                No active staff found. Please add staff in Settings &gt; Users.
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- Clean Inline Notes -->
      <div class="d-flex align-center gap-2 mb-4 px-3 py-2 bg-grey-lighten-4 rounded-lg border">
        <v-icon size="18" color="grey">mdi-note-edit-outline</v-icon>
        <input
          v-model="bookingForm.notes"
          :readonly="!canSalary('create')"
          type="text"
          placeholder="Add optional booking notes (e.g. Regular monthly payroll booking)..."
          class="clean-notes-input"
        />
      </div>

      <!-- Bottom Action Bar -->
      <div class="d-flex justify-end">
        <v-btn
          v-if="canSalary('create')"
          color="primary"
          variant="flat"
          rounded="lg"
          size="large"
          class="px-8 font-weight-bold text-capitalize"
          :loading="submitting"
          :disabled="!salaryStore.monthReady || salaryStore.mutationLoading || bookingForm.items.length === 0"
          @click="submitBooking"
        >
          Confirm &amp; Book {{ formattedMonthName }} Salary (AED {{ bookingComputedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
        </v-btn>
      </div>
    </v-card>

    <!-- CASE 2: BOOKED STATE - INTERACTIVE PAYROLL TABLE -->
    <v-card v-else-if="salaryStore.monthReady && salaryStore.isBooked" class="soft-card overflow-hidden pa-4" variant="flat" rounded="xl">
      <!-- Filter Bar & Search -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4">
        <!-- Search Input -->
        <div style="min-width: 260px; max-width: 360px;" class="flex-grow-1">
          <v-text-field
            v-model="search"
            placeholder="Search staff by name, designation..."
            prepend-inner-icon="mdi-magnify"
            hide-details
            density="compact"
            variant="outlined"
            rounded="lg"
            bg-color="grey-lighten-5"
          ></v-text-field>
        </div>

        <!-- Filter Controls -->
        <div class="d-flex align-center gap-3 flex-wrap">
          <v-select
            v-model="statusFilter"
            :items="['All', 'Unpaid', 'Partially Paid', 'Paid']"
            prepend-inner-icon="mdi-tune-variant"
            hide-details
            density="compact"
            variant="outlined"
            rounded="lg"
            bg-color="white"
            style="width: 170px;"
            class="text-caption"
          ></v-select>

          <v-chip variant="outlined" color="primary" class="font-weight-bold">
            Booking Date: {{ formatDate(salaryStore.payroll?.booking_date) }}
          </v-chip>
        </div>
      </div>

      <!-- Batch Transfer Action Banner (When rows are selected) -->
      <v-slide-y-transition>
        <div 
          v-if="selectedItems.length > 0" 
          class="pa-3 mb-4 rounded-xl d-flex align-center justify-space-between flex-wrap gap-3"
          style="background: #ECEAF6; border: 1px solid rgba(79, 66, 148, 0.25);"
        >
          <div class="d-flex align-center gap-3">
            <v-icon color="primary">mdi-checkbox-marked-circle-outline</v-icon>
            <div>
              <span class="font-weight-black color-primary text-body-2">
                {{ selectedItems.length }} staff member{{ selectedItems.length === 1 ? '' : 's' }} selected
              </span>
              <span class="text-caption text-grey-darken-2 ml-2">
                (Total Pending: <strong>AED {{ selectedPendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</strong>)
              </span>
            </div>
          </div>

          <div class="d-flex align-center gap-2">
            <v-btn
              variant="text"
              size="small"
              color="grey-darken-2"
              class="text-capitalize"
              @click="selectedItems = []"
            >
              Deselect All
            </v-btn>
            <v-btn
              v-if="canSalary('edit')"
              color="primary"
              prepend-icon="mdi-bank-transfer"
              rounded="lg"
              size="small"
              height="36"
              class="font-weight-bold text-capitalize"
              :disabled="paymentBlocked || selectedPendingTotal <= 0"
              @click="openBatchPayDialog"
            >
              Pay Selected (AED {{ selectedPendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
            </v-btn>
          </div>
        </div>
      </v-slide-y-transition>

      <!-- Interactive Salary Table -->
      <v-table class="bg-transparent elevation-0 custom-salary-table" hover>
        <thead>
          <tr>
            <th style="width: 48px;">
              <v-checkbox
                :model-value="isAllSelected"
                :indeterminate="isIndeterminate"
                hide-details
                density="compact"
                color="primary"
                @update:model-value="toggleSelectAll"
              ></v-checkbox>
            </th>
            <th class="text-left">STAFF MEMBER</th>
            <th class="text-right">NET SALARY</th>
            <th class="text-right">PAID</th>
            <th class="text-right">BALANCE</th>
            <th class="text-center">STATUS</th>
            <th class="text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="item in filteredItems" 
            :key="item.id"
            :class="{ 'bg-purple-lighten-5': isSelected(item) }"
          >
            <!-- Checkbox -->
            <td>
              <v-checkbox
                :model-value="isSelected(item)"
                hide-details
                density="compact"
                color="primary"
                :disabled="item.status === 'Paid'"
                @update:model-value="toggleSelectItem(item)"
              ></v-checkbox>
            </td>

            <!-- Staff Info -->
            <td>
              <div class="d-flex align-center gap-3 py-2">
                <v-avatar size="36" color="primary" variant="tonal">
                  <v-img v-if="item.Staff?.avatar" :src="item.Staff.avatar"></v-img>
                  <span v-else class="text-caption font-weight-bold">{{ item.Staff?.name?.charAt(0) || 'U' }}</span>
                </v-avatar>
                <div>
                  <div class="font-weight-bold text-body-2 color-on-surface">{{ item.Staff?.name }}</div>
                  <div class="text-caption text-grey-darken-1">{{ item.Staff?.designation || 'Staff' }}</div>
                </div>
              </div>
            </td>

            <!-- Net Salary -->
            <td class="text-right font-weight-black text-body-2 color-primary">
              AED {{ parseFloat(item.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </td>

            <!-- Paid -->
            <td class="text-right font-weight-bold text-body-2 text-success">
              AED {{ parseFloat(item.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </td>

            <!-- Pending -->
            <td class="text-right font-weight-black text-body-2">
              <span :class="salaryBalance(item.net_salary,item.paid_amount) > 0 ? 'text-error' : 'text-success'">
                AED {{ salaryBalance(item.net_salary,item.paid_amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </span>
            </td>

            <!-- Status Chip -->
            <td class="text-center">
              <v-chip
                size="small"
                rounded="pill"
                class="px-3 font-weight-bold text-capitalize"
                :color="item.status === 'Paid' ? 'success' : (item.status === 'Partially Paid' ? 'primary' : 'error')"
                variant="tonal"
                style="font-size: 11px; height: 24px;"
              >
                {{ item.status }}
              </v-chip>
            </td>

            <!-- Actions -->
            <td class="text-right">
              <div class="d-flex align-center justify-end gap-1">
                <!-- Pay Button (if not fully paid) -->
                <v-btn
                  v-if="selectedItems.length === 0 && item.status !== 'Paid' && canSalary('edit', item)"
                  color="primary"
                  variant="flat"
                  size="small"
                  rounded="lg"
                  class="font-weight-bold text-capitalize px-3"
                  @click="openSinglePayDialog(item)"
                  :disabled="paymentBlocked"
                >
                  Pay
                </v-btn>

                <!-- More actions menu -->
                <v-menu location="bottom end">
                  <template v-slot:activator="{ props }">
                    <v-btn icon="mdi-dots-horizontal" variant="text" size="small" color="grey-darken-1" v-bind="props"></v-btn>
                  </template>
                  <v-list density="compact" width="220" rounded="lg" elevation="3">
                    <v-list-item
                      prepend-icon="mdi-history"
                      title="Payment History"
                      @click="openHistoryDialog(item)"
                    ></v-list-item>

                    <v-list-item
                      prepend-icon="mdi-file-document-outline"
                      title="View Salary Breakdown"
                      @click="openBreakdownDialog(item)"
                    ></v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </td>
          </tr>

          <tr v-if="filteredItems.length === 0">
            <td colspan="7" class="text-center py-8 text-grey">
              No staff records matching the selected filter.
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- ==================== DIALOGS ==================== -->

    <!-- 2. INDIVIDUAL PAY SALARY DIALOG (FULL OR PARTIAL) -->
    <v-dialog v-model="singlePayDialog" max-width="540px" persistent>
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="primary" class="px-4">
          <v-toolbar-title class="font-weight-bold text-white">
            Pay Salary: {{ activeItem?.Staff?.name }}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" color="white" @click="singlePayDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Staff Summary Card -->
          <div class="pa-4 bg-grey-lighten-4 rounded-xl mb-5">
            <div class="d-flex align-center gap-3 mb-3">
              <v-avatar size="44" color="primary" variant="tonal">
                <v-img v-if="activeItem?.Staff?.avatar" :src="activeItem.Staff.avatar"></v-img>
                <span v-else class="text-subtitle-1 font-weight-bold">{{ activeItem?.Staff?.name?.charAt(0) }}</span>
              </v-avatar>
              <div>
                <div class="font-weight-bold text-body-1">{{ activeItem?.Staff?.name }}</div>
                <div class="text-caption text-grey-darken-1">{{ activeItem?.Staff?.designation || 'Staff' }} &bull; {{ formattedMonthName }}</div>
              </div>
            </div>

            <v-divider class="my-2"></v-divider>

            <div class="d-flex justify-space-between text-caption py-1">
              <span class="text-grey-darken-1">Net Monthly Salary:</span>
              <span class="font-weight-bold">AED {{ parseFloat(activeItem?.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="d-flex justify-space-between text-caption py-1">
              <span class="text-grey-darken-1">Already Paid:</span>
              <span class="font-weight-bold text-success">AED {{ parseFloat(activeItem?.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="d-flex justify-space-between text-body-2 py-1">
              <span class="font-weight-bold color-primary">Balance:</span>
              <span class="font-weight-black text-error">AED {{ remainingPendingForActiveItem.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
          </div>

          <!-- Payment Mode Selection -->
          <div class="text-caption font-weight-bold text-uppercase mb-2 text-grey-darken-1">Payment Mode</div>
          <v-radio-group v-model="singlePayForm.mode" inline class="mb-3">
            <v-radio label="Full Payment" value="full" color="primary"></v-radio>
            <v-radio label="Partial Payment" value="partial" color="primary"></v-radio>
          </v-radio-group>

          <!-- Custom Partial Amount Input -->
          <v-text-field
            v-if="singlePayForm.mode === 'partial'"
            v-model.number="singlePayForm.amount"
            label="Partial Payment Amount (AED)"
            type="number"
            :max="remainingPendingForActiveItem"
            min="1"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            prefix="AED"
            class="mb-3"
          ></v-text-field>

          <!-- Amount to pay preview -->
          <div class="pa-3 mb-4 rounded-lg d-flex justify-space-between align-center" style="background: rgba(46, 125, 50, 0.08); border: 1px solid rgba(46, 125, 50, 0.2);">
            <span class="text-caption font-weight-bold text-success text-uppercase">Payment Amount</span>
            <span class="text-h6 font-weight-black text-success">
              AED {{ currentSinglePayAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </span>
          </div>

          <!-- Bank / Wallet Account Selector -->
          <v-select
            v-model="singlePayForm.account_id"
            :items="walletStore.accounts"
            item-value="id"
            item-title="name"
            label="Pay From (Bank or Wallet Account)"
            placeholder="Select Bank or Cash Wallet"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mb-3"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="`${item.raw.account_type} • Balance: AED ${parseFloat(item.raw.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`">
                <template v-slot:prepend>
                  <v-avatar v-if="item.raw.logo_url" size="26" rounded="0" class="mr-2">
                    <v-img :src="item.raw.logo_url"></v-img>
                  </v-avatar>
                  <v-icon v-else size="24" class="mr-2" color="primary">
                    {{ item.raw.account_type === 'Cash' ? 'mdi-cash' : 'mdi-bank' }}
                  </v-icon>
                </template>
              </v-list-item>
            </template>
            <template v-slot:selection="{ item }">
              <div class="d-flex align-center gap-2">
                <v-avatar v-if="item.raw.logo_url" size="20" rounded="0">
                  <v-img :src="item.raw.logo_url"></v-img>
                </v-avatar>
                <span class="font-weight-medium">{{ item.raw.name }}</span>
                <span class="text-caption text-grey">({{ item.raw.account_type }})</span>
              </div>
            </template>
          </v-select>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="singlePayForm.payment_date"
                :rules="[paymentDateRule]"
                label="Payment Date"
                type="date"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="singlePayForm.payment_method"
                :items="['Bank Transfer', 'Cash', 'Cheque', 'Online']"
                label="Method"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-select>
            </v-col>
          </v-row>

          <v-text-field
            v-model="singlePayForm.notes"
            label="Transaction Reference / Note (Optional)"
            placeholder="e.g. Bank Ref #12345"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mt-2"
          ></v-text-field>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4 border-t d-flex justify-end gap-2">
          <v-btn variant="text" color="grey-darken-1" class="text-capitalize" @click="singlePayDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="px-6 font-weight-bold text-capitalize"
            :loading="submitting"
            :disabled="paymentBlocked || !singlePayForm.account_id || currentSinglePayAmount <= 0"
            @click="submitSinglePayment"
          >
            Process Transfer (AED {{ currentSinglePayAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 3. BATCH / BULK TRANSFER DIALOG -->
    <v-dialog v-model="batchPayDialog" max-width="640px" persistent>
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="primary" class="px-4">
          <v-toolbar-title class="font-weight-bold text-white">
            Batch Salary Transfer
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" color="white" @click="batchPayDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <div class="pa-4 rounded-xl mb-4" style="background: rgba(79, 66, 148, 0.08); border: 1px solid rgba(79, 66, 148, 0.2);">
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-caption font-weight-bold text-uppercase opacity-70">Selected Staff Members</span>
              <span class="font-weight-bold text-body-2">{{ selectedItems.length }} Persons</span>
            </div>
            <div class="d-flex justify-space-between align-center">
              <span class="text-caption font-weight-bold text-uppercase opacity-70">Total Transfer Amount</span>
              <span class="text-h6 font-weight-black color-primary">
                AED {{ selectedPendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </span>
            </div>
          </div>

          <!-- Selected Staff List Preview -->
          <div class="border rounded-xl mb-4 overflow-hidden" style="max-height: 200px; overflow-y: auto;">
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">STAFF</th>
                  <th class="text-right">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in selectedItems" :key="item.id">
                  <td>
                    <span class="font-weight-medium text-body-2">{{ item.Staff?.name }}</span>
                    <span class="text-caption text-grey ml-1">({{ item.Staff?.designation || 'Staff' }})</span>
                  </td>
                  <td class="text-right font-weight-black text-error">
                    AED {{ salaryBalance(item.net_salary,item.paid_amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>

          <!-- Bank / Wallet Account Selector -->
          <v-select
            v-model="batchPayForm.account_id"
            :items="walletStore.accounts"
            item-value="id"
            item-title="name"
            label="Pay From (Bank or Wallet Account)"
            placeholder="Select Bank or Cash Wallet"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mb-3"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="`${item.raw.account_type} • Balance: AED ${parseFloat(item.raw.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`">
                <template v-slot:prepend>
                  <v-avatar v-if="item.raw.logo_url" size="26" rounded="0" class="mr-2">
                    <v-img :src="item.raw.logo_url"></v-img>
                  </v-avatar>
                  <v-icon v-else size="24" class="mr-2" color="primary">
                    {{ item.raw.account_type === 'Cash' ? 'mdi-cash' : 'mdi-bank' }}
                  </v-icon>
                </template>
              </v-list-item>
            </template>
            <template v-slot:selection="{ item }">
              <div class="d-flex align-center gap-2">
                <v-avatar v-if="item.raw.logo_url" size="20" rounded="0">
                  <v-img :src="item.raw.logo_url"></v-img>
                </v-avatar>
                <span class="font-weight-medium">{{ item.raw.name }}</span>
                <span class="text-caption text-grey">({{ item.raw.account_type }})</span>
              </div>
            </template>
          </v-select>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="batchPayForm.payment_date"
                :rules="[paymentDateRule]"
                label="Payment Date"
                type="date"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="batchPayForm.payment_method"
                :items="['Bank Transfer', 'Cash', 'Cheque', 'Online']"
                label="Method"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-select>
            </v-col>
          </v-row>

          <v-text-field
            v-model="batchPayForm.notes"
            label="Batch Reference / Notes"
            placeholder="e.g. September Salary Payment via WPS / Corporate Bank"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mt-2"
          ></v-text-field>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4 border-t d-flex justify-end gap-2">
          <v-btn variant="text" color="grey-darken-1" class="text-capitalize" @click="batchPayDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="px-6 font-weight-bold text-capitalize"
            :loading="submitting"
            :disabled="paymentBlocked || !batchPayForm.account_id || selectedPendingTotal <= 0"
            @click="submitBatchPayment"
          >
            Pay Selected (AED {{ selectedPendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) }})
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 4. PAYMENT HISTORY & BREAKDOWN DIALOG -->
    <v-dialog v-model="historyDialog" max-width="760px">
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="surface" flat border-b class="px-4">
          <v-toolbar-title class="font-weight-bold">
            Payment History &bull; {{ activeItem?.Staff?.name }}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" @click="historyDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <div class="pa-4 bg-grey-lighten-4 rounded-xl mb-4">
            <div class="d-flex justify-space-between text-body-2 py-1">
              <span class="text-grey-darken-1">Net Salary:</span>
              <span class="font-weight-bold">AED {{ parseFloat(activeItem?.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="d-flex justify-space-between text-body-2 py-1">
              <span class="text-grey-darken-1">Paid:</span>
              <span class="font-weight-bold text-success">AED {{ parseFloat(activeItem?.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="d-flex justify-space-between text-body-2 py-1">
              <span class="text-grey-darken-1">Balance:</span>
              <span class="font-weight-bold text-error">AED {{ remainingPendingForActiveItem.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
            </div>
          </div>

          <div class="font-weight-bold text-caption text-uppercase mb-3 opacity-60">
            Payment Transactions ({{ salaryStore.paymentHistory.length }})
          </div>

          <div v-if="salaryStore.historyLoading" class="text-center py-6">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
          </div>

          <v-alert v-else-if="salaryStore.historyError" type="error" variant="tonal">
            {{ salaryStore.historyError }}
            <v-btn size="small" variant="text" @click="salaryStore.fetchPaymentHistory(activeItem.id)">Retry history</v-btn>
          </v-alert>
          <div v-else-if="salaryStore.paymentHistory.length === 0" class="text-center py-6 text-grey">
            No payments have been recorded for this staff member yet.
          </div>

          <div v-else class="border rounded-xl overflow-hidden">
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">DATE</th>
                  <th class="text-left">ACCOUNT / METHOD</th>
                  <th class="text-right">AMOUNT</th>
                  <th>STATUS / CORRECTION</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pay in salaryStore.paymentHistory" :key="pay.id">
                  <td>{{ formatDate(pay.payment_date) }}</td>
                  <td>
                    <div class="font-weight-medium text-caption">{{ pay.Account?.name || 'Bank' }}</div>
                    <div class="text-caption text-grey opacity-70">{{ pay.payment_method }}</div>
                  </td>
                  <td class="text-right font-weight-black text-success">
                    AED {{ parseFloat(pay.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                  </td>
                  <td>
                    <div v-if="pay.reversed_at" class="py-2 text-caption">
                      <v-chip size="x-small" color="warning">Reversed</v-chip>
                      <div class="mt-1">{{ formatDate(pay.reversed_at) }} · User #{{ pay.reversed_by_user_id }}</div>
                      <div>{{ pay.reversal_reason }}</div>
                      <div class="text-grey">Wallet credit #{{ pay.reversal_transaction_id }}</div>
                    </div>
                    <v-btn v-else-if="canReverseSalary" size="small" variant="text" color="error" :disabled="paymentBlocked" @click="openReversalDialog(pay)">Reverse payment</v-btn>
                    <span v-else class="text-caption">Recorded</span>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="reversalDialog" max-width="540px" persistent>
      <v-card class="rounded-xl">
        <v-card-title class="pa-5">Reverse salary payment</v-card-title>
        <v-card-text>
          <p class="mb-4">Return AED {{ Number(reversingPayment?.amount || 0).toFixed(2) }} to {{ reversingPayment?.Account?.name || 'the original wallet' }} and reopen this salary balance. The original payment and booked salary expense stay in the history.</p>
          <v-textarea v-model="reversalReason" label="Reason (required)" maxlength="2000" counter rows="3" variant="outlined" :disabled="submitting" />
          <p class="text-caption text-grey">If confirmation is interrupted, retry this same payment and reason. It cannot be credited twice.</p>
        </v-card-text>
        <v-card-actions class="pa-4 justify-end">
          <v-btn :disabled="submitting" @click="reversalDialog=false">Cancel</v-btn>
          <v-btn color="error" variant="flat" :loading="submitting" :disabled="!reversalReason.trim() || paymentBlocked" @click="submitReversal">Confirm reversal</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 5. SALARY BREAKDOWN SLIP DIALOG -->
    <v-dialog v-model="breakdownDialog" max-width="500px">
      <v-card class="rounded-xl overflow-hidden">
        <v-toolbar color="surface" flat border-b class="px-4">
          <v-toolbar-title class="font-weight-bold">
            Salary Breakdown &bull; {{ activeItem?.Staff?.name }}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" @click="breakdownDialog = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <v-avatar size="44" color="primary" variant="tonal">
              <v-img v-if="activeItem?.Staff?.avatar" :src="activeItem.Staff.avatar"></v-img>
              <span v-else class="text-subtitle-1 font-weight-bold">{{ activeItem?.Staff?.name?.charAt(0) }}</span>
            </v-avatar>
            <div>
              <div class="font-weight-bold text-body-1">{{ activeItem?.Staff?.name }}</div>
              <div class="text-caption text-grey">{{ activeItem?.Staff?.designation || 'Staff' }} &bull; {{ formattedMonthName }}</div>
            </div>
          </div>

          <v-table density="compact" class="border rounded-xl">
            <tbody>
              <tr v-if="activeItem?.base_salary != null">
                <td class="font-weight-bold">Monthly salary basis</td>
                <td class="text-right font-weight-bold">AED {{ Number(activeItem.base_salary).toFixed(2) }}</td>
              </tr>
              <tr v-if="activeItem?.master_base_salary != null && Number(activeItem.master_base_salary) !== Number(activeItem.base_salary)">
                <td class="text-grey-darken-1">Staff salary at booking</td>
                <td class="text-right">AED {{ Number(activeItem.master_base_salary).toFixed(2) }}</td>
              </tr>
              <tr>
                <td class="text-grey-darken-1 font-weight-medium">Basic Salary</td>
                <td class="text-right font-weight-bold">AED {{ parseFloat(activeItem?.basic_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr>
                <td class="text-grey-darken-1 font-weight-medium">HR / Housing Allowance</td>
                <td class="text-right font-weight-bold">AED {{ parseFloat(activeItem?.hr_allowance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr>
                <td class="text-grey-darken-1 font-weight-medium">Other Allowances</td>
                <td class="text-right font-weight-bold">AED {{ parseFloat(activeItem?.other_allowances || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr v-if="basisAdjustment !== null && basisAdjustment !== 0">
                <td class="text-grey-darken-1">Monthly basis adjustment</td>
                <td class="text-right">{{ basisAdjustment > 0 ? '+' : '−' }} AED {{ Math.abs(basisAdjustment).toFixed(2) }}</td>
              </tr>
              <tr v-if="parseFloat(activeItem?.daily_rate || 0) > 0">
                <td class="text-grey-darken-1 font-weight-medium">Daily Rate (Based on {{ activeItem?.days_in_month || daysInCurrentMonth }} days; rounded for display)</td>
                <td class="text-right font-weight-bold">AED {{ parseFloat(activeItem?.daily_rate).toFixed(2) }}/day</td>
              </tr>
              <tr v-if="parseFloat(activeItem?.leave_days || 0) > 0">
                <td class="text-error font-weight-medium">Leave Days Taken</td>
                <td class="text-right font-weight-bold text-error">{{ activeItem?.leave_days }} Days (-AED {{ parseFloat(activeItem?.leave_deduction || 0).toFixed(2) }})</td>
              </tr>
              <tr v-if="parseFloat(activeItem?.bonus || 0) > 0">
                <td class="text-success font-weight-medium">Bonus / Incentives</td>
                <td class="text-right font-weight-bold text-success">+ AED {{ parseFloat(activeItem?.bonus).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr v-if="parseFloat(activeItem?.deductions || 0) > 0">
                <td class="text-error font-weight-medium">Other Deductions</td>
                <td class="text-right font-weight-bold text-error">- AED {{ parseFloat(activeItem?.deductions).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
              </tr>
              <tr class="bg-grey-lighten-4">
                <td class="font-weight-black color-primary">Net Monthly Salary</td>
                <td class="text-right font-weight-black text-subtitle-1 color-primary">
                  AED {{ parseFloat(activeItem?.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <div v-if="activeItem?.override_reason" class="mt-3 text-body-2"><strong>Override reason:</strong> {{ activeItem.override_reason }}</div>
          <div v-if="activeItem?.base_salary == null" class="mt-3 text-caption text-grey">Historical payroll: the original monthly salary basis was not recorded.</div>
          <div v-else class="mt-3 text-caption text-grey">Leave deduction = monthly salary basis × leave days ÷ {{ activeItem.days_in_month }} calendar days, rounded once to cents. Net = basis − leave deduction − other deductions + bonus.</div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSalaryStore } from '~/stores/salary';
import { useWalletStore } from '~/stores/wallet';
import { useAuthStore } from '~/stores/auth';
import { canAccessSalary } from '~/utils/recordPermissions';
import { useUIStore } from '~/stores/ui';
import { getBankLogo } from '~/utils/banks';
import { calculateSalary, cents, salaryBalance, paymentDateRule } from '~/utils/salaryCalculation.mjs';
import {businessDate} from '~/utils/businessDate';

const salaryStore = useSalaryStore();
const walletStore = useWalletStore();
const auth = useAuthStore();
const canSalary = (action, record) => canAccessSalary(auth.user, action, record);
const uiStore = useUIStore();

// UI Filters
const search = ref('');
const statusFilter = ref('All');

// Selection state
const selectedItems = ref([]);

// Active item for modals
const activeItem = ref(null);
const basisAdjustment=computed(()=>activeItem.value?.base_salary==null?null:Math.round((Number(activeItem.value.base_salary)-Number(activeItem.value.basic_salary||0)-Number(activeItem.value.hr_allowance||0)-Number(activeItem.value.other_allowances||0))*100)/100);
const submitting = ref(false);
const paymentBlocked = computed(() => !salaryStore.monthReady || salaryStore.mutationLoading || submitting.value || salaryStore.paymentSubmitting || !!salaryStore.pendingPayment || !!salaryStore.paymentRefreshWarning);
const canReverseSalary=computed(()=>auth.user?.role?.toLowerCase()==='admin' && auth.user?.role_type!=='CustomerPortal');
const hasPaymentHistory=computed(()=>salaryStore.items.some(item=>item.Payments?.length>0));
const reversalDialog=ref(false),reversingPayment=ref(null),reversalReason=ref('');

// Dialogs
const singlePayDialog = ref(false);
const batchPayDialog = ref(false);
const historyDialog = ref(false);
const breakdownDialog = ref(false);
watch(()=>[salaryStore.monthRequestId,salaryStore.salaryViewVersion],()=>{
  selectedItems.value=[];activeItem.value=null;
  singlePayDialog.value=false;batchPayDialog.value=false;historyDialog.value=false;breakdownDialog.value=false;
  reversalDialog.value=false;
});
watch(historyDialog,open=>{if(!open)salaryStore.clearPaymentHistory();});

// Forms
const bookingForm = ref({
  booking_date: '',
  notes: '',
  items: []
});

const daysInCurrentMonth = computed(() => {
  if (!salaryStore.currentMonth) return 30;
  const [year, month] = salaryStore.currentMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
});

const bookingComputedTotal = computed(() => {
  return bookingSum('net_salary');
});
function bookingSum(field){try{return (bookingForm.value.items||[]).reduce((sum,item)=>sum+cents(item[field]??0),0)/100;}catch{return 0;}}
function hasSalaryOverride(staff){try{return cents(staff.base_salary)!==cents(staff.master_base_salary);}catch{return true;}}
function calculateBookingRow(staff){
  try{
    const result=calculateSalary(staff,daysInCurrentMonth.value);
    if(result.net_salary<0)throw new Error('Deductions cannot exceed salary plus bonus.');
    Object.assign(staff,result,{calculationError:''});
    return true;
  }catch(err){staff.calculationError=err.message;staff.net_salary=0;return false;}
}
const onStaffBaseSalaryChange=calculateBookingRow;
const onStaffLeaveChange=calculateBookingRow;

const initBookingForm = () => {
  bookingForm.value.booking_date = salaryStore.monthData?.suggestedBookingDate || '';
  bookingForm.value.notes = '';
  const days = daysInCurrentMonth.value || 30;
  bookingForm.value.items = (salaryStore.staffPreview || []).map(s => {
    const base = Number(s.base_salary ?? s.net_salary ?? 0);
    return {
      user_id: s.user_id,
      name: s.Staff?.name || s.name,
      designation: s.Staff?.designation || s.designation,
      avatar: s.Staff?.avatar || s.avatar,
      basic_salary: parseFloat(s.basic_salary) || 0,
      hr_allowance: parseFloat(s.hr_allowance) || 0,
      other_allowances: parseFloat(s.other_allowances) || 0,
      base_salary: base,
      master_base_salary:Number(s.master_base_salary ?? base),
      override_reason:'',
      leave_days: 0,
      daily_rate: calculateSalary({base_salary:base},days).daily_rate,
      leave_deduction: 0.00,
      deductions: 0.00,
      bonus: 0.00,
      net_salary: base,
      editingSalary: false
    };
  });
};

watch(() => salaryStore.staffPreview, () => {
  if (!salaryStore.isBooked) {
    initBookingForm();
  }
}, { immediate: true });

const incrementLeave = (staff) => {
  if(!canSalary('create'))return;
  const maxDays = daysInCurrentMonth.value || 30;
  const current = parseFloat(staff.leave_days) || 0;
  if (current < maxDays) {
    staff.leave_days = Math.min(maxDays,Math.round((current+1)*10)/10);
    onStaffLeaveChange(staff);
  }
};

const decrementLeave = (staff) => {
  if(!canSalary('create'))return;
  const current = parseFloat(staff.leave_days) || 0;
  if (current > 0) {
    staff.leave_days = Math.max(0, current - 1);
    onStaffLeaveChange(staff);
  }
};

const promptEditLeave = (staff) => {
  if(!canSalary('create'))return;
  const input = prompt(`Enter unpaid leave days for ${staff.name} (0 to ${daysInCurrentMonth.value}):`, staff.leave_days || 0);
  if (input !== null && input.trim() !== '') {
    const val = parseFloat(input);
    if (/^\d+(\.\d)?$/.test(input.trim()) && !isNaN(val) && val >= 0 && val <= daysInCurrentMonth.value) {
      staff.leave_days = val;
      onStaffLeaveChange(staff);
    }
  }
};

const saveSalaryEdit = (staff) => {
  if(!canSalary('create'))return;
  staff.editingSalary = false;
  onStaffBaseSalaryChange(staff);
};

const singlePayForm = ref({
  mode: 'full',
  amount: 0,
  account_id: null,
  payment_date: businessDate(),
  payment_method: 'Bank Transfer',
  notes: ''
});

const batchPayForm = ref({
  account_id: null,
  payment_date: businessDate(),
  payment_method: 'Bank Transfer',
  notes: ''
});

// Mounted
onMounted(() => {
  try { salaryStore.restorePendingPayment(); } catch (err) { uiStore.showError(err.message); }
});

// Computed Month Displays
const formattedMonthName = computed(() => {
  if (!salaryStore.currentMonth) return '';
  const [year, month] = salaryStore.currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
});

const isCurrentMonth = computed(() => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  return salaryStore.currentMonth === `${yyyy}-${mm}`;
});

const statusColor = computed(() => {
  const st = salaryStore.monthTotals.status;
  if (st === 'Paid') return 'success';
  if (st === 'Partially Paid') return 'primary';
  if (st === 'Booked') return 'warning';
  return 'grey';
});

const paidPercentage = computed(() => {
  const total = salaryStore.monthTotals.total;
  if (!total || total === 0) return 0;
  return Math.min(100, Math.round((salaryStore.monthTotals.paid / total) * 100));
});

// Filtered items in booked table
const filteredItems = computed(() => {
  let list = salaryStore.items || [];
  if (statusFilter.value !== 'All') {
    list = list.filter(item => item.status === statusFilter.value);
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(item => {
      const name = item.Staff?.name?.toLowerCase() || '';
      const desig = item.Staff?.designation?.toLowerCase() || '';
      return name.includes(q) || desig.includes(q);
    });
  }
  return list;
});

// Selection helpers
const isSelected = (item) => {
  return selectedItems.value.some(i => i.id === item.id);
};

const toggleSelectItem = (item) => {
  const idx = selectedItems.value.findIndex(i => i.id === item.id);
  if (idx > -1) {
    selectedItems.value.splice(idx, 1);
  } else {
    selectedItems.value.push(item);
  }
};

const isAllSelected = computed(() => {
  const selectable = filteredItems.value.filter(i => i.status !== 'Paid');
  return selectable.length > 0 && selectable.every(i => isSelected(i));
});

const isIndeterminate = computed(() => {
  const selectable = filteredItems.value.filter(i => i.status !== 'Paid');
  const count = selectable.filter(i => isSelected(i)).length;
  return count > 0 && count < selectable.length;
});

const toggleSelectAll = (val) => {
  const selectable = filteredItems.value.filter(i => i.status !== 'Paid');
  if (val) {
    selectedItems.value = [...selectable];
  } else {
    selectedItems.value = [];
  }
};

const selectedPendingTotal = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    return sum + Math.max(0, cents(item.net_salary||0) - cents(item.paid_amount||0));
  }, 0)/100;
});

const remainingPendingForActiveItem = computed(() => {
  if (!activeItem.value) return 0;
  return salaryBalance(activeItem.value.net_salary,activeItem.value.paid_amount);
});

const currentSinglePayAmount = computed(() => {
  if (singlePayForm.value.mode === 'full') {
    return remainingPendingForActiveItem.value;
  }
  return parseFloat(singlePayForm.value.amount || 0);
});

// Month change functions
const changeMonth = async (delta) => {
  const [year, month] = salaryStore.currentMonth.split('-').map(Number);
  const newDate = new Date(year, month - 1 + delta, 1);
  const newY = newDate.getFullYear();
  const newM = String(newDate.getMonth() + 1).padStart(2, '0');
  selectedItems.value = [];
  await salaryStore.fetchMonthPayroll(`${newY}-${newM}`);
};

const jumpToCurrentMonth = async () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  selectedItems.value = [];
  await salaryStore.fetchMonthPayroll(`${yyyy}-${mm}`);
};

const reloadMonth = async () => {
  selectedItems.value = [];
  await salaryStore.fetchMonthPayroll(salaryStore.currentMonth);
};

const submitBooking = async () => {
  if (!canSalary('create') || submitting.value || !salaryStore.monthReady || salaryStore.mutationLoading) return;
  for(const staff of bookingForm.value.items){
    if(!calculateBookingRow(staff)){uiStore.showError(`${staff.name}: ${staff.calculationError}`);return;}
    if(hasSalaryOverride(staff)&&!staff.override_reason?.trim()){uiStore.showError(`Enter a salary override reason for ${staff.name}.`);return;}
  }
  submitting.value = true;
  try {
    const result=await salaryStore.bookMonthSalary({
      booking_date: bookingForm.value.booking_date,
      notes: bookingForm.value.notes,
      items: bookingForm.value.items
    });
    if(result?.refreshFailed)uiStore.showError('Payroll was booked successfully, but loading failed. Refresh payroll before making changes.');
    else uiStore.showSuccess(`Salary for ${formattedMonthName.value} booked successfully!`);
  } catch (err) {
    uiStore.showError(err.response?.data?.message || 'Failed to book salary');
  } finally {
    submitting.value = false;
  }
};

const confirmUnbook = async () => {
  if(!salaryStore.monthReady || salaryStore.mutationLoading || submitting.value || salaryStore.paymentSubmitting || salaryStore.pendingPayment)return;
  if (confirm(`Are you sure you want to unbook the salary for ${formattedMonthName.value}?`)) {
    try {
      const result=await salaryStore.unbookMonthSalary(salaryStore.currentMonth);
      if(result?.refreshFailed)uiStore.showError('Payroll was unbooked successfully, but loading failed. Refresh payroll before making changes.');
      else uiStore.showSuccess('Monthly salary unbooked');
    } catch (err) {
      uiStore.showError(err.response?.data?.message || 'Failed to unbook salary');
    }
  }
};

const openSinglePayDialog = (item) => {
  if (paymentBlocked.value) return;
  activeItem.value = item;
  const pending = salaryBalance(item.net_salary,item.paid_amount);
  singlePayForm.value = {
    mode: 'full',
    amount: pending,
    account_id: walletStore.accounts[0]?.id || null,
    payment_date: businessDate(),
    payment_method: 'Bank Transfer',
    notes: ''
  };
  singlePayDialog.value = true;
};

const submitSinglePayment = async () => {
  if (paymentBlocked.value || !activeItem.value || !singlePayForm.value.account_id) return;
  const validDate=paymentDateRule(singlePayForm.value.payment_date);
  if(validDate!==true){uiStore.showError(validDate);return;}
  submitting.value = true;
  try {
    await salaryStore.paySingleSalary({
      salary_item_id: activeItem.value.id,
      account_id: singlePayForm.value.account_id,
      amount: currentSinglePayAmount.value,
      payment_date: singlePayForm.value.payment_date,
      payment_method: singlePayForm.value.payment_method,
      notes: singlePayForm.value.notes
    });
    uiStore.showSuccess('Salary payment recorded successfully');
    singlePayDialog.value = false;
  } catch (err) {
    if (salaryStore.pendingPayment) singlePayDialog.value = false;
    uiStore.showError(err.response?.data?.message || 'Failed to process payment');
  } finally {
    submitting.value = false;
  }
};

const openBatchPayDialog = () => {
  if (paymentBlocked.value) return;
  if (selectedItems.value.length === 0) return;
  batchPayForm.value = {
    account_id: walletStore.accounts[0]?.id || null,
    payment_date: businessDate(),
    payment_method: 'Bank Transfer',
    notes: ''
  };
  batchPayDialog.value = true;
};

const submitBatchPayment = async () => {
  if (paymentBlocked.value || selectedItems.value.length === 0 || !batchPayForm.value.account_id) return;
  const validDate=paymentDateRule(batchPayForm.value.payment_date);
  if(validDate!==true){uiStore.showError(validDate);return;}
  submitting.value = true;
  try {
    const ids = selectedItems.value.map(i => i.id);
    await salaryStore.payBatchSalary({
      salary_item_ids: ids,
      account_id: batchPayForm.value.account_id,
      payment_date: batchPayForm.value.payment_date,
      payment_method: batchPayForm.value.payment_method,
      notes: batchPayForm.value.notes
    });
    uiStore.showSuccess('Batch salary payment processed successfully');
    selectedItems.value = [];
    batchPayDialog.value = false;
  } catch (err) {
    if (salaryStore.pendingPayment) batchPayDialog.value = false;
    uiStore.showError(err.response?.data?.message || 'Failed to process batch payment');
  } finally {
    submitting.value = false;
  }
};

const retrySalaryPayment = async () => {
  if (submitting.value || salaryStore.paymentSubmitting) return;
  submitting.value = true;
  try {
    const result = await salaryStore.retryPendingPayment();
    singlePayDialog.value = false; batchPayDialog.value = false; selectedItems.value = [];
    uiStore.showSuccess(result.message || 'Original salary transfer confirmed.');
  } catch (err) {
    uiStore.showError(err.response?.data?.message || err.message || 'Unable to confirm the original transfer.');
  } finally { submitting.value = false; }
};

const openHistoryDialog = async (item) => {
  if(!salaryStore.monthReady)return;
  activeItem.value = item;
  historyDialog.value = true;
  await salaryStore.fetchPaymentHistory(item.id);
};

function openReversalDialog(payment){
  if(!canReverseSalary.value||paymentBlocked.value||payment.reversed_at)return;
  reversingPayment.value=payment;reversalReason.value='';reversalDialog.value=true;
}
async function submitReversal(){
  if(!canReverseSalary.value||paymentBlocked.value||!reversingPayment.value||!reversalReason.value.trim())return;
  submitting.value=true;
  try{
    const result=await salaryStore.reverseSalaryPayment(reversingPayment.value.id,reversalReason.value.trim());
    reversalDialog.value=false;
    if(result.refreshFailed)uiStore.showError('Payment reversed successfully, but loading failed. Refresh payroll before continuing.');
    else uiStore.showSuccess(result.message||'Salary payment reversed.');
  }catch(err){uiStore.showError(err.response?.data?.message||err.message||'Unable to confirm reversal. Retry the same payment and reason.');}
  finally{submitting.value=false;}
}

const openBreakdownDialog = (item) => {
  if(!salaryStore.monthReady)return;
  activeItem.value = item;
  breakdownDialog.value = true;
};

// Utils
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB',{timeZone:'Asia/Dubai'});
};

const getAccountLogo = (accName) => {
  return getBankLogo(accName);
};
</script>

<style scoped>
.custom-salary-table th {
  color: #4F4294 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
}

.custom-salary-table tr:hover td {
  background: rgba(79, 66, 148, 0.04) !important;
}

.clean-mini-input {
  border: 1px solid #D1C4E9;
  background: #FFFFFF;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 14px;
  width: 120px;
  outline: none;
  transition: border-color 0.2s;
}
.clean-mini-input:focus {
  border-color: #4F4294;
  box-shadow: 0 0 0 2px rgba(79, 66, 148, 0.15);
}

.clean-date-input {
  border: 1px solid #E0E0E0;
  background: #FFFFFF;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 13px;
  color: #333;
  outline: none;
}
.clean-date-input:focus {
  border-color: #4F4294;
}

.clean-notes-input {
  border: none;
  background: transparent;
  width: 100%;
  padding: 4px 6px;
  font-size: 13px;
  outline: none;
}

.hover-bg-grey:hover td {
  background: rgba(79, 66, 148, 0.02) !important;
}
</style>
