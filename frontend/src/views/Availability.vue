<script setup>
import AvailabilityPanel from "../components/AvailabilityPanel.vue";
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 mb-4">Check availability</h1>
    <v-card rounded="lg" class="pa-4" elevation="2">
      <AvailabilityPanel />
    </v-card>
  </v-container>
</template>
