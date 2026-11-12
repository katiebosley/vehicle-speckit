<script setup>
import Utils from "../config/utils.js";
import { roleLabel } from "../utils/roles.js";

const user = Utils.getStore("user");
</script>

<template>
  <v-container class="py-10">
    <h1 class="text-h4 mb-2">Welcome, {{ user?.firstName }}</h1>
    <p class="text-body-1">{{ roleLabel(user?.role) }}</p>
  </v-container>
</template>
