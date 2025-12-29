<template>
  <div class="remote-publish-container">
    <!-- WebApiHost -->
    <fieldset
      class="form-server-fieldset pr10"
      v-if="props.data.webApiHost && props.data.webApiHost.length > 0"
    >
      <legend class="form-server-legend">{{ webApiHostName }}</legend>
      <div
        class="card-item-appconfig"
        v-for="(webApi, index) in props.data.webApiHost"
        :key="index"
      >
        <table class="table-appconfig" cellpadding="0" cellspacing="0">
          <tr>
            <th>应用服务器</th>
            <td :title="String(webApi.serverIp)">{{ webApi.serverName }}</td>
            <th>服务环境</th>
            <td>
              <label v-if="webApi.serverOs">{{ displayOs(webApi.serverOs) }}</label>
            </td>
          </tr>
          <tr>
            <td colspan="4" class="t-align-c">
              <template
                v-for="serverConf in webApi.serverConfigs"
                :key="serverConf.serverIdentity"
              >
                <table
                  class="table-appconfig mt10 mb10 t-border-none"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <th>服务标识</th>
                    <td>{{ serverConf.serverIdentity }}</td>
                  </tr>
                  <tr>
                    <th>发布路径</th>
                    <td>{{ serverConf.publishPath }}</td>
                  </tr>
                </table>
              </template>
            </td>
          </tr>
        </table>
      </div>
      <div class="appconfig-remove-btn">
        <el-button
          type="danger"
          plain
          size="small"
          title="移除[WebApiHost]模块"
          :disabled="props.loading == true"
          @click="props.data.webApiHost = null"
          >移除</el-button
        >
      </div>
    </fieldset>

    <!-- ScheduleServer -->
    <fieldset
      class="form-server-fieldset pr10"
      v-if="props.data.scheduleServer && props.data.scheduleServer.length > 0"
    >
      <legend class="form-server-legend">{{ scheduleServerName }}</legend>
      <div
        class="card-item-appconfig"
        v-for="(schedule, index) in props.data.scheduleServer"
        :key="index"
      >
        <table class="table-appconfig" cellpadding="0" cellspacing="0">
          <tr>
            <th>应用服务器</th>
            <td :title="String(schedule.serverIp)">{{ schedule.serverName }}</td>
            <th>服务环境</th>
            <td>
              <label v-if="schedule.serverOs">{{ displayOs(schedule.serverOs) }}</label>
            </td>
          </tr>
          <tr>
            <td colspan="4" class="t-align-c">
              <template
                v-for="serverConf in schedule.serverConfigs"
                :key="serverConf.serverIdentity"
              >
                <table
                  class="table-appconfig mt10 mb10 t-border-none"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <th>服务标识</th>
                    <td>{{ serverConf.serverIdentity }}</td>
                  </tr>
                  <tr>
                    <th>发布路径</th>
                    <td>{{ serverConf.publishPath }}</td>
                  </tr>
                </table>
              </template>
            </td>
          </tr>
        </table>
      </div>
      <div class="appconfig-remove-btn">
        <el-button
          type="danger"
          plain
          size="small"
          title="移除[ScheduleServer]模块"
          :disabled="props.loading == true"
          @click="props.data.scheduleServer = null"
          >移除</el-button
        >
      </div>
    </fieldset>

    <!-- WebClient -->
    <fieldset
      class="form-server-fieldset pr10"
      v-if="props.data.webClient && props.data.webClient.length > 0"
    >
      <legend class="form-server-legend">{{ webClientName }}</legend>
      <div
        class="card-item-appconfig"
        v-for="(web, index) in props.data.webClient"
        :key="index"
      >
        <table class="table-appconfig" cellpadding="0" cellspacing="0">
          <tr>
            <th>应用服务器</th>
            <td :title="String(web.serverIp)">{{ web.serverName }}</td>
            <th>服务环境</th>
            <td>
              <label v-if="web.serverOs">{{ displayOs(web.serverOs) }}</label>
            </td>
          </tr>
          <tr>
            <td colspan="4" class="t-align-c">
              <template
                v-for="serverConf in web.serverConfigs"
                :key="serverConf.serverIdentity"
              >
                <table
                  class="table-appconfig mt10 mb10 t-border-none"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <th>服务标识</th>
                    <td>{{ serverConf.serverIdentity }}</td>
                  </tr>
                  <tr>
                    <th>发布路径</th>
                    <td>{{ serverConf.publishPath }}</td>
                  </tr>
                </table>
              </template>
            </td>
          </tr>
        </table>
      </div>
      <div class="appconfig-remove-btn">
        <el-button
          type="danger"
          plain
          size="small"
          title="移除[WebClient]模块"
          :disabled="props.loading == true"
          @click="props.data.webClient = null"
          >移除</el-button
        >
      </div>
    </fieldset>

    <!-- SpcMonitor -->
    <fieldset
      class="form-server-fieldset pr10"
      v-if="props.data.spcMonitor && props.data.spcMonitor.length > 0"
    >
      <legend class="form-server-legend">{{ spcMonitorName }}</legend>
      <div
        class="card-item-appconfig"
        v-for="(spc, index) in props.data.spcMonitor"
        :key="index"
      >
        <table class="table-appconfig" cellpadding="0" cellspacing="0">
          <tr>
            <th>应用服务器</th>
            <td :title="String(spc.serverIp)">{{ spc.serverName }}</td>
            <th>服务环境</th>
            <td>
              <label v-if="spc.serverOs">{{ displayOs(spc.serverOs) }}</label>
            </td>
          </tr>
          <tr>
            <td colspan="4" class="t-align-c">
              <template
                v-for="serverConf in spc.serverConfigs"
                :key="serverConf.serverIdentity"
              >
                <table
                  class="table-appconfig mt10 mb10 t-border-none"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <th>服务标识</th>
                    <td>{{ serverConf.serverIdentity }}</td>
                  </tr>
                  <tr>
                    <th>发布路径</th>
                    <td>{{ serverConf.publishPath }}</td>
                  </tr>
                </table>
              </template>
            </td>
          </tr>
        </table>
      </div>
      <div class="appconfig-remove-btn">
        <el-button
          type="danger"
          plain
          size="small"
          title="移除[SpcMonitor]模块"
          :disabled="props.loading == true"
          @click="props.data.spcMonitor = null"
          >移除</el-button
        >
      </div>
    </fieldset>

    <!-- WpfClient -->
    <fieldset class="form-server-fieldset pr10" v-if="props.data.wpfClient">
      <legend class="form-server-legend">{{ wpfClientName }}</legend>
      <div class="card-item-appconfig">
        <table class="table-appconfig" cellpadding="0" cellspacing="0">
          <tr>
            <th>应用服务器</th>
            <td :title="String(props.data.wpfClient.serverIp)">
              {{ props.data.wpfClient.serverName }}
            </td>
            <th>服务环境</th>
            <td>
              <label v-if="props.data.wpfClient.serverOs">{{
                displayOs(props.data.wpfClient.serverOs)
              }}</label>
            </td>
          </tr>
          <tr>
            <th>发布路径</th>
            <td colspan="4">{{ props.data.wpfClient.publishPath }}</td>
          </tr>
        </table>
      </div>
      <div class="appconfig-remove-btn">
        <el-button
          type="danger"
          plain
          size="small"
          title="移除[WpfClient]模块"
          :disabled="props.loading == true"
          @click="props.data.wpfClient = null"
          >移除</el-button
        >
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts" name="remotePublishItem">
import { defineProps, ref } from "vue";
import { displayOs } from "@/utils/other";

const webApiHostName = ref("WebApiHost");
const scheduleServerName = ref("ScheduleServer");
const webClientName = ref("WebClient");
const wpfClientName = ref("WpfClient");
const spcMonitorName = ref("SpcMonitor");

// 定义父组件传过来的值
const props = defineProps({
  // 远程发布数据
  data: {
    type: Object as () => RemotePublishType,
    default: () => {},
  },
  loading: {
    type: Boolean,
    default: false,
  },
});
</script>

<style lang="scss" scoped>
.remote-publish-container {
  margin: 0px;

  .form-server-fieldset {
    width: 100%;
    border: 1px #dcdfe6 solid;
    padding-top: 8px;
    padding-left: 10px;
    padding-bottom: 15px;
    margin-top: 10px;
  }

  .form-server-legend {
    padding: 0px 5px;
    margin-left: 15px;
  }

  .appconfig-remove-btn {
    margin-top: 15px;
    text-align: center;
  }

  .card-item-appconfig {
    width: 100%;
    .table-appconfig {
      width: 100%;
      border-collapse: collapse;
      tr {
        th {
          background-color: #fbfbfb;
          font-weight: 500;
          text-align: right;
          font-size: 14px;
          width: 110px;
          padding: 10px 5px;
          border: 1px solid #eeeeee;
        }
        td {
          font-size: 14px;
          text-align: left;
          padding: 0px 5px;
          border: 1px solid #eeeeee;
          word-wrap: break-word;
          word-break: break-all;
        }
      }
    }
  }

  .t-align-c {
    text-align: center !important;
  }
  .mb0 {
    margin-bottom: 0px !important;
  }
  .t-border-none {
    border: 0px solid white !important;
  }
}
</style>
