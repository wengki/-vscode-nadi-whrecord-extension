<script lang="ts">
  import { onMount } from "svelte";
	import Child from './Setting.svelte';
	import { setting } from './setting.js'

  let historyList: any = initHistoryList;
  let text = "";

  onMount(() => {
    window.addEventListener("message", (event) => {
      const message = event.data;
      switch (message.type) {
        case "onHistoryChange":
          // historyList = [{ text: message.value, completed: false }, ...historyList];
          break;
        case "getHistoryOfMonth":
          if (historyList && historyList.hasOwnProperty(message.value.key)) {
            historyList[message.value.key].list = message.value.list;
          }
          break;
        default:
          break;
      }
    });
  });
</script>

<button
  on:click={() => {
    nadivscode.postMessage({
      type: "onOpenWorkingFilesHistory",
      value: undefined,
    });
  }}>All History By Date</button
>

<h4><b>Work History</b></h4>
<div class="sidebar-history-box">
<ul class="sidebar-history-list">
  {#each Object.entries(historyList) as [key, value]}
    {#if value.text != undefined || !isNaN(value.count)}
    <li
      on:click={() => {
        nadivscode.postMessage({
          type: "getHistoryOfMonth",
          value: key,
        });
      }}
    >
      <div class="title">
        {value.text} <span class="badge">{value.count}</span>
      </div>
      {#if value && value.hasOwnProperty("list")}
        <ul class="sidebar-history-item-list">
          {#each value.list as item}
            <li>
              <div
                on:click={() => {
                  nadivscode.postMessage({
                    type: 'onOpenWorkingFilesHistory',
                    value: item.dirname
                  })
                }}
              >
                {item.text}
                {#if parseInt(item.count) > 0}
                  <span class="badge">{item.count}</span>
                {:else}
                  <small class="italic gray">No files changed</small>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </li>
    {/if}
  {/each}
</ul>
</div>
<Child bind:value={$setting}/>