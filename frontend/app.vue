<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { watch } from 'vue';
import { useTheme } from 'vuetify';
import { useConfigStore } from '~/stores/config';
import { applyWorkspaceTheme } from '~/utils/themes';

const theme = useTheme();
const configStore = useConfigStore();

watch(
  () => [configStore.themeName, configStore.betaThemeColors],
  ([name, colors]) => applyWorkspaceTheme(theme, name, colors),
  { immediate: true, deep: true }
);
</script>
