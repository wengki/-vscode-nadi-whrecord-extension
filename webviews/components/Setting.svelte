<script lang="ts">
  import { onMount } from "svelte";

  let historyIgnoreList = settings.historyIgnore;
  let historyIgnorePopOpen = false;
  let cancelRemoveHistoryIgnoreItem = '';

  onMount(() => {
    window.addEventListener("message", (event) => {
      switch (event.data.type) {
        case 'settingHistoryIgnoreCANCELRemoveItem': {
            cancelRemoveHistoryIgnoreItem = '';
            break;
        }
      }
    });
  });
</script>

<div
  class="pop-box bottom right historyIgnoreList {historyIgnorePopOpen
    ? 'show'
    : 'hide'}"
>
  <ul>  
    {#each historyIgnoreList as item}
      <li>
        <div class="title" title="{item}">
          {item}
        </div>
        <div class="del-button">
          <label class="switch">
            <input
              type="checkbox" checked={(cancelRemoveHistoryIgnoreItem != item) ? true : false}
              on:change={() => {
                cancelRemoveHistoryIgnoreItem = item;
                nadivscode.postMessage({
                  type: "settingHistoryIgnoreRemoveItem",
                  value: item,
                });
              }}
            />
            <span class="slider round" />
          </label>
        </div>
      </li>
    {/each}
  </ul>
</div>

<div class="sidebar-panel-bottom">
  <div class="left">
    <span
      class="clickable"
      on:click={() => {
        nadivscode.postMessage({
          type: "onRunDeveloperTool",
          value: null,
        });
      }}>Dev Tool</span
    >
    <span
      class="clickable"
      on:click={() => {
        nadivscode.postMessage({
          type: "onReloadWindow",
          value: null,
        });
      }}>Reload</span
    >
  </div>
  <div class="right">
    <span
      class="clickable"
      on:click={() => {
        historyIgnorePopOpen = historyIgnorePopOpen ? false : true;
      }}
    >
      History Ignore
    </span>
  </div>
</div>
