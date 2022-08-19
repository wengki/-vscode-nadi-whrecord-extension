<script lang="ts">
  import { onMount } from "svelte";

  let projectFileHistory: any = workFilesHistory;
  let historyCollections: any = {};

  let getDateHour = (time: number) => {
    var month = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const dirnameToDate = new Date(time);
    var dd = String(dirnameToDate.getDate()).padStart(2, "0");
    var mmm = month[dirnameToDate.getMonth()];
    var yyyy = dirnameToDate.getFullYear();

    return `${mmm} ${dd}, ${yyyy} ${String(dirnameToDate.getHours()).padStart(
      2,
      "0"
    )}:${String(dirnameToDate.getMinutes()).padStart(2, "0")}`;
  };

  onMount(() => {
    window.addEventListener("message", (event) => {
      // const message = event.data;
      // console.log({message})
      switch (event.data.type) {
        case "receiveHistoryCollections":
          historyCollections = Object.assign(
            historyCollections,
            event.data.value
          );
          // console.log(historyCollections);
          break;

        default:
          break;
      }
    });
  });
</script>

<h2>Working File History</h2>
{#if targetFolderData.hasOwnProperty("date")}
  <h3>{targetFolderData.date}</h3>
{/if}
{#if targetFolderData.hasOwnProperty("date") && targetFolderData.hasOwnProperty("key")}
<ul class="history-list-collection">
    {#each projectFileHistory[targetFolderData.key] as item}
      <li>
        <span
          class="info-path"
          on:click={() => {
            nadivscode.postMessage({
              type: "seeHistoryFileDiff",
              value: Object.assign(item, {
                dirname: targetFolderData.key,
              }),
            });
          }}>{item.rpath}</span
        >
        <!-- ( {item.index} ) -->
        <div>
          <small>
            {#if item.hasOwnProperty("rename")}
              <span class="info-rename">
                {getDateHour(item.rename)} -> new/rename
              </span>
            {/if}
            {#if item.hasOwnProperty("change")}
              <span class="info-change"
                >{getDateHour(item.change)} -> last change</span
              >
            {/if}
          </small>
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <ul class="history-list">
    {#each projectFileHistory as historyDate}
      <li>
        <span
          on:click={() => {
            nadivscode.postMessage({
              type: "getHistoryCollections",
              value: historyDate.path,
            });
          }}>{historyDate.text}</span
        >
        <!-- {historyDate.dirname} -->
        {#if historyCollections.hasOwnProperty(historyDate.dirname)}
          {#if historyCollections[historyDate.dirname].length > 0}
            <ul class="history-list-collection">
              {#each historyCollections[historyDate.dirname] as item}
                <li>
                  <span
                    class="info-path"
                    on:click={() => {
                      nadivscode.postMessage({
                        type: "seeHistoryFileDiff",
                        value: Object.assign(item, {
                          dirname: historyDate.dirname,
                        }),
                      });
                    }}>{item.rpath}</span
                  >
                  <!-- ( {item.index} ) -->
                  <div>
                    <small>
                      {#if item.hasOwnProperty("rename")}
                        <span class="info-rename">
                          {getDateHour(item.rename)} -> new/rename
                        </span>
                      {/if}
                      {#if item.hasOwnProperty("change")}
                        <span class="info-change"
                          >{getDateHour(item.change)} -> last change</span
                        >
                      {/if}
                    </small>
                  </div>
                </li>
              {/each}
            </ul>
          {:else}
            <div>There is no history of changes to the project.</div>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/if}
