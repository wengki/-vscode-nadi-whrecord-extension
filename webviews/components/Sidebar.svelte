<script lang="ts">
  import { onMount } from "svelte";

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
          if (historyList.hasOwnProperty(message.value.key)) {
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
      type: "onRunDeveloperTool",
      value: "Tesssss",
    });
  }}>Run Dev Tool</button
>

<button
  on:click={() => {
    nadivscode.postMessage({
      type: "onOpenWorkingFilesHistory",
      value: undefined,
    });
  }}>Open Working Files History</button
>

<h4><b>Work History</b></h4>
<ul class="sidebar-history-list">
  {#each Object.entries(historyList) as [key, value]}
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
      {#if value.hasOwnProperty("list")}
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
  {/each}
</ul>
