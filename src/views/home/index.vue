<template>
  <div class="publish-container layout-pd">
    <el-row :gutter="15" class="publish-card-box mb15">
      <el-col :xs="24" :sm="12" :md="12" :lg="6" :xl="6" v-for="(fun, index) in visibleFunModule" :key="fun.title" :class="{
        'publish-media publish-media-lg': fun.origIndex > 1,
        'publish-media-sm': fun.origIndex === 1,
      }">
        <div class="publish-card-item flex" v-loading="fun.loading" :element-loading-text="fun.loadingText"
          @click="onFunModuleHandle(index)">
          <!-- <div class="flex-margin flex w100" :class="` publish-animation${index}`"> -->
          <div class="flex-margin flex w100">
            <div class="flex-auto">
              <div class="card-item-title">{{ fun.title }}</div>
            </div>
            <div class="publish-card-item-icon flex" :style="{ background: `var(${fun.iconBgColor})` }">
              <svg-icon class="flex-margin" :size="32" :name="fun.iconFont" :class="fun.iconFont"
                :color="`var(${fun.iconColor})`" />
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    <el-row :gutter="15" class="publish-card-config">
      <el-col :xs="24" :sm="10" :md="10" :lg="12" :xl="8" class="publish-media">
        <div class="publish-card-item">
          <div class="card-item-box">
            <div class="card-title">
              <el-row>
                <el-col :span="12">发布信息</el-col>
                <el-col :span="12">
                  <div class="item-btn-box">
                    <!-- :disabled="
                        state.funModule[currModuleIndex].loading == true ||
                        state.publishData.appconfigData.id == null ||
                        state.publishData.appconfigData.id <= 0
                      " -->
                    <el-button size="small" title="生成SMOM发布文件" text @click="onGeneratePublish">
                      <svg-icon :size="32" color="#606266" title="生成SMOM发布文件" name="smom-icon smom-icon-shengchengqi" />
                    </el-button>
                    <el-button title="修改应用配置" size="small" text :icon="EditPen" :disabled="state.funModule[currModuleIndex].loading == true ||
                      state.publishData.appconfigData.id == null ||
                      state.publishData.appconfigData.id <= 0
                      " @click="onOpenAppConfig"></el-button>
                    <el-button title="刷新|重置" size="small" text :icon="Refresh"
                      :disabled="state.funModule[currModuleIndex].loading == true"
                      @click="getProjectDefault({ keepCurrentEnvironment: true })"></el-button>
                  </div>
                </el-col>
              </el-row>
            </div>
            <div class="card-item-content">
              <el-row>
                <el-col :span="24">
                  <el-select filterable placeholder="请选择要发布的项目" size="default" v-model="state.publishData.projectId"
                    class="mb15" :disabled="state.funModule[currModuleIndex].loading == true" @change="onProjectChange">
                    <el-option v-for="project in projectList" :key="project.id" :label="project.name"
                      :value="project.id" />
                  </el-select>
                </el-col>
              </el-row>

              <div class="card-item-env">
                <el-radio-group size="default" @change="onEnvironmentChange" v-model="state.publishData.environment"
                  :disabled="state.funModule[currModuleIndex].loading == true">
                  <el-radio border :value="1">Dev</el-radio>
                  <el-radio border :value="2">Uat</el-radio>
                  <el-radio border :value="3">Pro</el-radio>
                  <el-radio border :value="4">Other</el-radio>
                </el-radio-group>
              </div>
              <div class="card-item-appconfig">
                <table class="table-appconfig" cellpadding="0" cellspacing="0">
                  <tr>
                    <th>程序集输出路径</th>
                    <td>
                      <a class="t-link-path" href="javascript:void(0);" title="打开程序集输出路径"
                        @click="onOpenAssemblyOutPath(state.publishData.assemblyOutPath)"
                        v-if="state.publishData.assemblyOutPath">{{ state.publishData.assemblyOutPath }}</a>
                      <label v-else>未配置，将采用默认路径</label>
                    </td>
                  </tr>
                </table>
              </div>
              <div class="card-item-appconfig" v-if="state.publishData.appconfigData.dllMode">
                <table class="table-appconfig" cellpadding="0" cellspacing="0">
                  <tr>
                    <th>获取dll方式</th>
                    <td colspan="3">{{ showDllMode() }}</td>
                  </tr>
                  <tr
                    v-show="state.publishData.appconfigData.dllMode == 'TFS' || state.publishData.appconfigData.dllMode == 'Git'">
                    <th>生成发布日志</th>
                    <td>
                      <el-switch v-model="generatePublishLog.isEnable" :active-value="true" :inactive-value="false"
                        :disabled="state.funModule[currModuleIndex].loading == true" inline-prompt active-text="开启"
                        inactive-text="关闭" size="default" />
                    </td>
                    <th v-show="generatePublishLog.isEnable">生成方式</th>
                    <td v-show="generatePublishLog.isEnable">
                      <el-select v-model="generatePublishLog.type"
                        :disabled="state.funModule[currModuleIndex].loading == true" placeholder="请选择生成方式"
                        size="default" style="min-width: 50px">
                        <el-option label="默认" value="默认" />
                        <el-option label="仅发布内容" value="仅发布内容" />
                        <el-option label="按日期" value="按日期" />
                        <el-option label="按用户" value="按用户" />
                      </el-select>
                    </td>
                  </tr>
                  <tr v-show="(state.publishData.appconfigData.dllMode == 'TFS' || state.publishData.appconfigData.dllMode == 'Git') &&
                    generatePublishLog.type !== '仅发布内容' &&
                    generatePublishLog.isEnable
                    ">
                    <th>生成信息(包含)</th>
                    <td colspan="3">
                      <el-checkbox v-model="generatePublishLog.displayPublishField.isChangeSet"
                        :disabled="state.funModule[currModuleIndex].loading == true" size="default" label="变更集" />
                      <el-checkbox v-model="generatePublishLog.displayPublishField.isDateTime"
                        :disabled="state.funModule[currModuleIndex].loading == true" size="default" label="日期" />
                      <el-checkbox v-model="generatePublishLog.displayPublishField.isUser"
                        :disabled="state.funModule[currModuleIndex].loading == true" size="default" label="用户" />
                      <el-checkbox v-model="generatePublishLog.displayPublishField.isDll"
                        :disabled="state.funModule[currModuleIndex].loading == true" size="default" label="DLL" />
                    </td>
                  </tr>
                </table>
              </div>
              <div class="card-item-appconfig" v-if="state.publishData.appconfigData.msBuildPath">
                <table class="table-appconfig" cellpadding="0" cellspacing="0">
                  <tr>
                    <th>MsBuild路径</th>
                    <td colspan="3">{{ state.publishData.appconfigData.msBuildPath }}</td>
                  </tr>
                  <tr>
                    <th>强制重新生成</th>
                    <td>
                      {{
                        state.publishData.appconfigData.configItems.isRebuild == 1
                          ? "是"
                          : "否"
                      }}
                    </td>
                    <th>发布前备份</th>
                    <td>
                      <el-switch v-model="state.publishData.appconfigData.configItems.isBackup" :active-value="1"
                        :inactive-value="0" :disabled="state.funModule[currModuleIndex].loading == true" inline-prompt
                        active-text="开启" inactive-text="关闭" size="default" />
                    </td>
                  </tr>
                  <tr>
                    <th>异步上传</th>
                    <td>
                      <el-switch
                        v-model="isAsyncMode"
                        :active-value="true"
                        :inactive-value="false"
                        :disabled="state.funModule[currModuleIndex].loading == true"
                        inline-prompt
                        active-text="开启"
                        inactive-text="关闭"
                        size="default"
                      />
                      <el-tooltip
                        content="异步模式下仅 WebApiHost / ScheduleServer / WpfClient / SpcMonitor 并行执行，WebClient 仍需等待所有 WebApiHost 完成后才执行。"
                        placement="top"
                        effect="light"
                      >
                        <el-icon
                          style="
                            margin-left: 10px;
                            position: relative;
                            top: 4px;
                            cursor: help;
                            color: #909399;
                          "
                        >
                          <QuestionFilled />
                        </el-icon>
                      </el-tooltip>
                    </td>
                    <th></th>
                    <td></td>
                  </tr>
                </table>
              </div>
              <div class="card-item-appconfig">
                <table class="table-appconfig mb15" cellpadding="0" cellspacing="0" v-if="
                  state.publishData.appconfigData.configItems?.webApiHost?.clientPath
                ">
                  <tr>
                    <th>应用类型</th>
                    <td>{{ webApiHostName }}</td>
                  </tr>
                  <tr>
                    <th>客户端生成路径</th>
                    <td>
                      <a
                        class="t-link-path"
                        href="javascript:void(0);"
                        title="打开客户端生成路径"
                        @click="
                          onOpenClientPath(
                            state.publishData.appconfigData.configItems.webApiHost
                              .clientPath
                          )
                        "
                        v-if="
                          state.publishData.appconfigData.configItems.webApiHost
                            .clientPath
                        "
                        >{{
                          state.publishData.appconfigData.configItems.webApiHost
                            .clientPath
                        }}</a
                      >
                      <label v-else></label>
                    </td>
                  </tr>
                  <template v-for="(apiServer, asIndex) in state.publishData.appconfigData
                    .configItems.webApiHost.serverArr" :key="asIndex">
                    <tr>
                      <th colspan="2" class="t-align-c">{{ apiServer.name }}</th>
                    </tr>
                    <tr>
                      <td colspan="2" class="t-align-c">
                        <template v-for="serverPath in apiServer.serverPathArr">
                          <table class="table-appconfig table-appconfig-shadow-none mt10 mb10 t-border-none"
                            cellpadding="0" cellspacing="0" v-for="(serverVal, valIndex) in serverPath.value"
                            :key="valIndex">
                            <tr>
                              <th>服务标识</th>
                              <td>{{ serverVal.identity }}</td>
                            </tr>
                            <tr>
                              <th>发布路径</th>
                              <td>{{ serverVal.path }}</td>
                            </tr>
                          </table>
                        </template>
                      </td>
                    </tr>
                  </template>
                  <tr>
                    <td colspan="2" align="center" class="pt5 pb5 t-align-c">
                      <el-button type="danger" plain size="small" title="将该模块移除(让其不参与编译/发布)"
                        :disabled="state.funModule[currModuleIndex].loading == true" @click="
                          state.publishData.appconfigData.configItems.webApiHost.clientPath =
                          ''
                          ">移除</el-button>
                    </td>
                  </tr>
                </table>
                <table class="table-appconfig mb15" cellpadding="0" cellspacing="0" v-if="
                  state.publishData.appconfigData.configItems?.webClient?.clientPath
                ">
                  <tr>
                    <th>应用类型</th>
                    <td>{{ webClientName }}</td>
                  </tr>
                  <tr>
                    <th>客户端生成路径</th>
                    <td>
                      <a
                        class="t-link-path"
                        href="javascript:void(0);"
                        title="打开客户端生成路径"
                        @click="
                          onOpenClientPath(
                            state.publishData.appconfigData.configItems.webClient.clientPath
                          )
                        "
                        v-if="
                          state.publishData.appconfigData.configItems.webClient.clientPath
                        "
                        >{{
                          state.publishData.appconfigData.configItems.webClient.clientPath
                        }}</a
                      >
                      <label v-else></label>
                    </td>
                  </tr>
                  <template v-for="(webServer, wsIndex) in state.publishData.appconfigData
                    .configItems.webClient.serverArr" :key="wsIndex">
                    <tr>
                      <th colspan="2" class="t-align-c">{{ webServer.name }}</th>
                    </tr>
                    <tr>
                      <td colspan="2" class="t-align-c">
                        <template v-for="serverPath in webServer.serverPathArr">
                          <table class="table-appconfig table-appconfig-shadow-none mb10 mt10 t-border-none"
                            cellpadding="0" cellspacing="0" v-for="(serverVal, valIndex) in serverPath.value"
                            :key="valIndex">
                            <tr>
                              <th>服务标识</th>
                              <td>{{ serverVal.identity }}</td>
                            </tr>
                            <tr>
                              <th>发布路径</th>
                              <td>{{ serverVal.path }}</td>
                            </tr>
                          </table>
                        </template>
                      </td>
                    </tr>
                  </template>
                  <tr>
                    <td colspan="2" align="center" class="pt5 pb5 t-align-c">
                      <el-button type="danger" plain size="small" title="将该模块移除(让其不参与编译/发布)"
                        :disabled="state.funModule[currModuleIndex].loading == true" @click="
                          state.publishData.appconfigData.configItems.webClient.clientPath =
                          ''
                          ">移除</el-button>
                    </td>
                  </tr>
                </table>
                <table class="table-appconfig mb15" cellpadding="0" cellspacing="0" v-if="
                  state.publishData.appconfigData.configItems?.scheduleServer
                    ?.clientPath
                ">
                  <tr>
                    <th>应用类型</th>
                    <td>{{ scheduleServerName }}</td>
                  </tr>
                  <tr>
                    <th>客户端生成路径</th>
                    <td>
                      <a
                        class="t-link-path"
                        href="javascript:void(0);"
                        title="打开客户端生成路径"
                        @click="
                          onOpenClientPath(
                            state.publishData.appconfigData.configItems.scheduleServer
                              .clientPath
                          )
                        "
                        v-if="
                          state.publishData.appconfigData.configItems.scheduleServer
                            .clientPath
                        "
                        >{{
                          state.publishData.appconfigData.configItems.scheduleServer
                            .clientPath
                        }}</a
                      >
                      <label v-else></label>
                    </td>
                  </tr>
                  <template v-for="(scheduleServer, asIndex) in state.publishData.appconfigData
                    .configItems.scheduleServer.serverArr" :key="asIndex">
                    <tr>
                      <th colspan="2" class="t-align-c">{{ scheduleServer.name }}</th>
                    </tr>
                    <tr>
                      <td colspan="2" class="t-align-c">
                        <template v-for="serverPath in scheduleServer.serverPathArr">
                          <table class="table-appconfig table-appconfig-shadow-none mt10 mb10 t-border-none"
                            cellpadding="0" cellspacing="0" v-for="(serverVal, valIndex) in serverPath.value"
                            :key="valIndex">
                            <tr>
                              <th>服务标识</th>
                              <td>{{ serverVal.identity }}</td>
                            </tr>
                            <tr>
                              <th>发布路径</th>
                              <td>{{ serverVal.path }}</td>
                            </tr>
                          </table>
                        </template>
                      </td>
                    </tr>
                  </template>
                  <tr>
                    <td colspan="2" align="center" class="pt5 pb5 t-align-c">
                      <el-button type="danger" plain size="small" title="将该模块移除(让其不参与编译/发布)"
                        :disabled="state.funModule[currModuleIndex].loading == true" @click="
                          state.publishData.appconfigData.configItems.scheduleServer.clientPath =
                          ''
                          ">移除</el-button>
                    </td>
                  </tr>
                </table>
                <table class="table-appconfig mb15" cellpadding="0" cellspacing="0" v-if="
                  state.publishData.appconfigData.configItems?.wpfClient?.clientPath
                ">
                  <tr>
                    <th>应用类型</th>
                    <td>{{ wpfClientName }}</td>
                  </tr>
                  <tr>
                    <th>客户端生成路径</th>
                    <td>
                      <a
                        class="t-link-path"
                        href="javascript:void(0);"
                        title="打开客户端生成路径"
                        @click="
                          onOpenClientPath(
                            state.publishData.appconfigData.configItems.wpfClient
                              .clientPath
                          )
                        "
                        v-if="
                          state.publishData.appconfigData.configItems.wpfClient
                            .clientPath
                        "
                        >{{
                          state.publishData.appconfigData.configItems.wpfClient
                            .clientPath
                        }}</a
                      >
                      <label v-else></label>
                    </td>
                  </tr>
                  <tr>
                    <th>生成的目录</th>
                    <td>
                      {{
                        showGenerateDir(
                          String(
                            state.publishData.appconfigData.configItems.wpfClient
                              .generateDirJson
                          )
                        )
                      }}
                    </td>
                  </tr>
                  <tr>
                    <th>是否打包(压缩)</th>
                    <td>
                      {{
                        state.publishData.appconfigData.configItems.wpfClient
                          .isCompress == 1
                          ? "是"
                          : "否"
                      }}
                    </td>
                  </tr>
                  <tr v-if="
                    state.publishData.appconfigData.configItems.wpfClient.isCompress ==
                    1
                  ">
                    <th>打包(压缩)文件</th>
                    <td>
                      {{
                        showCompressFile(
                          String(
                            state.publishData.appconfigData.configItems.wpfClient
                              .compressFileJson
                          )
                        )
                      }}
                    </td>
                  </tr>
                  <tr>
                    <th>应用服务器</th>
                    <td>
                      {{
                        state.publishData.appconfigData.configItems.wpfClient.serverName
                      }}
                    </td>
                  </tr>
                  <tr>
                    <th>服务端发布路径</th>
                    <td>
                      {{
                        state.publishData.appconfigData.configItems.wpfClient.serverPath
                      }}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" align="center" class="pt5 pb5 t-align-c">
                      <el-button type="danger" plain size="small" title="将该模块移除(让其不参与编译/发布)"
                        :disabled="state.funModule[currModuleIndex].loading == true" @click="
                          state.publishData.appconfigData.configItems.wpfClient.clientPath =
                          ''
                          ">移除</el-button>
                    </td>
                  </tr>
                </table>
                <table class="table-appconfig" cellpadding="0" cellspacing="0" v-if="
                  state.publishData.appconfigData.configItems?.spcMonitor?.clientPath
                ">
                  <tr>
                    <th>应用类型</th>
                    <td>{{ spcMonitorName }}</td>
                  </tr>
                  <tr>
                    <th>客户端生成路径</th>
                    <td>
                      <a
                        class="t-link-path"
                        href="javascript:void(0);"
                        title="打开客户端生成路径"
                        @click="
                          onOpenClientPath(
                            state.publishData.appconfigData.configItems.spcMonitor
                              .clientPath
                          )
                        "
                        v-if="
                          state.publishData.appconfigData.configItems.spcMonitor
                            .clientPath
                        "
                        >{{
                          state.publishData.appconfigData.configItems.spcMonitor
                            .clientPath
                        }}</a
                      >
                      <label v-else></label>
                    </td>
                  </tr>
                  <template v-for="(spcServer, ssIndex) in state.publishData.appconfigData
                    .configItems.spcMonitor.serverArr" :key="ssIndex">
                    <tr>
                      <th colspan="2" class="t-align-c">{{ spcServer.name }}</th>
                    </tr>
                    <tr>
                      <td colspan="2" class="t-align-c">
                        <template v-for="serverPath in spcServer.serverPathArr">
                          <table class="table-appconfig table-appconfig-shadow-none mb10 mt10 t-border-none"
                            cellpadding="0" cellspacing="0" v-for="(serverVal, valIndex) in serverPath.value"
                            :key="valIndex">
                            <tr>
                              <th>服务标识</th>
                              <td>{{ serverVal.identity }}</td>
                            </tr>
                            <tr>
                              <th>发布路径</th>
                              <td>{{ serverVal.path }}</td>
                            </tr>
                          </table>
                        </template>
                      </td>
                    </tr>
                  </template>
                  <tr>
                    <td colspan="2" align="center" class="pt5 pb5 t-align-c">
                      <el-button type="danger" plain size="small" title="将该模块移除(让其不参与编译/发布)"
                        :disabled="state.funModule[currModuleIndex].loading == true" @click="
                          state.publishData.appconfigData.configItems.spcMonitor.clientPath =
                          ''
                          ">移除</el-button>
                    </td>
                  </tr>
                </table>
                <el-empty description="无应用配置信息." v-show="showEmptyAppConfig" :image-size="150" />
              </div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="10" :md="10" :lg="12" :xl="8">
        <div class="publish-card-item">
          <div class="card-item-box">
            <div class="card-title">
              <el-row>
                <el-col :span="12">日志信息</el-col>
                <el-col :span="12">
                  <div class="item-btn-box">
                    <el-button title="清空日志" size="small" text :icon="CircleClose" @click="onRemoveLogs"></el-button>
                  </div>
                </el-col>
              </el-row>
            </div>
            <div ref="logContentRef" class="card-item-content log-content">
              <p v-for="log in logPrintInfo" :class="log.type">
                {{ log.content.value }}
                <el-text :type="log.content.uploadFile.currNumber >=
                  log.content.uploadFile.totalNumber
                  ? 'primary'
                  : 'warning'
                  " size="small" v-if="log.content.uploadFile && log.content.uploadFile.totalNumber > 0">{{
                    log.content.uploadFile.prefix
                  }}{{ log.content.uploadFile.currNumber }}/{{
                    log.content.uploadFile.totalNumber
                  }}
                  个文件。</el-text>
              </p>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    <appconfig-dialog ref="appconfigDialogRef" @environment-change="onAppConfigEnvChange" @refresh="getPublishAppconfigs()" />
    <generate-publish-dialog :done="execApplicationAssemblyDone" @exec-application-assembly="onExecApplicationAssembly"
      @exec-done="onExecDone" @refresh="getPublishAppconfigs()" ref="generatePublishDialogRef" />
    <scheduled-publish-dialog ref="scheduledPublishDialogRef" @refresh="getPublishAppconfigs()" />
  </div>
</template>

<script setup lang="ts" name="home">
import {
  reactive,
  ref,
  computed,
  onBeforeMount,
  onMounted,
  onUnmounted,
  onActivated,
  defineAsyncComponent,
  nextTick,
} from "vue";
import { ElMessage } from "element-plus";
import _ from "lodash";
import { Refresh, CircleClose, EditPen, QuestionFilled } from "@element-plus/icons-vue";
import { useProjectDb } from "@/database/project/index";
import { useAppconfigDb } from "@/database/appconfig/index";
import { useServerDb } from "@/database/servers/index";
import { useTfsDb } from "@/database/teamFoundationServer/index";
import { useGitDb } from "@/database/git/index";
import { useBackupDb } from "@/database/backups/index";
import { usePublishScheduleDb } from "@/database/publishSchedule/index";
import {
  displayEnvironment,
  removeSlash,
  getDefaultSubObject,
  displayOs,
} from "@/utils/other";
import { formatDate } from "@/utils/formatTime";
import { cmdInvoke } from "@/utils/command";
import { path } from "@tauri-apps/api";
import { loadBackupItems } from "@/utils/backupAppconfig";
import { backupRemoteServer } from "@/utils/backupAppconfig";
import {
  outPublishContents,
  outDetaultPublishContents,
  outPublishContentByDates,
  outPublishContentByUsers,
  getDllFilesByChangedItems,
  getTfsChangedPath,
  type DllResolveOptions,
} from "@/utils/outPublishInfo";
import { sendNotification } from '@tauri-apps/plugin-notification';
import mittBus from "@/utils/mitt";
import { useSettingsDb } from "@/database/settings/index";
import { loadPublishSettings } from "@/utils/publishSettings";

const SvgIcon = defineAsyncComponent(() => import("@/components/svgIcon/index.vue"));

// 引入应用配置数据库
const projectDb = useProjectDb();
const appconfigDb = useAppconfigDb();
const serverDb = useServerDb();
const tfsDb = useTfsDb();
const gitDb = useGitDb();
const backupDb = useBackupDb();
const publishScheduleDb = usePublishScheduleDb();
const settingsDb = useSettingsDb();
const oneClickEnabled = ref(0); // 0 关 / 1 开

const reloadSettings = async () => {
  const r = await settingsDb.getSettings();
  if (r.code === 0 && r.data) oneClickEnabled.value = r.data.oneClickPublishEnabled;
  // 同步刷新 publishSettings 缓存（供调用点 getRetryArgs 使用）
  await loadPublishSettings();
};

// 引入组件
const appconfigDialogRef = ref();
const generatePublishDialogRef = ref();
const scheduledPublishDialogRef = ref();
const AppconfigDialog = defineAsyncComponent(
  () => import("@/views/appconfig/components/appconfigDialog.vue")
);
const GeneratePublishDialog = defineAsyncComponent(
  () => import("@/views/home/components/generatePublishDialog.vue")
);
const ScheduledPublishDialog = defineAsyncComponent(
  () => import("@/views/home/components/scheduledPublishDialog.vue")
);

// 定义变量内容
const projectList = ref<RowProjectType[]>();
const isRefreshingProjectDefault = ref(false);
const showEmptyAppConfig = ref(false);
const webApiHostName = ref("WebApiHost");
const scheduleServerName = ref("ScheduleServer");
const webClientName = ref("WebClient");
const wpfClientName = ref("WpfClient");
const spcMonitorName = ref("SpcMonitor");
const projectAssemblyOutPath = ref("");
// 异步上传模式
const isAsyncMode = ref(false);
const logContentRef = ref();
const logPrintInfo = ref<LogPrintType[]>([]);
const generatePublishLog = ref({
  isEnable: true,
  type: "默认",
  displayPublishField: {
    isChangeSet: true,
    isUser: true,
    isDateTime: true,
    isDll: true,
  } as DisplayPublishFieldType,
  data: "",
  logs: "",
});
// 定时发布相关
const scheduledTimerRef = ref<ReturnType<typeof setInterval> | null>(null);
const isScheduledRunning = ref(false);
const state = reactive({
  funModule: [
    {
      title: "一键发布",
      iconBgColor: "--el-color-primary-light-9",
      iconFont: "smom-icon smom-icon-fabu",
      iconColor: "--el-color-primary",
      loading: false,
      loadingText: "一键发布中",
    },
    {
      title: "编译项目",
      iconBgColor: "--next-color-warning-lighter",
      iconFont: "smom-icon smom-icon-bianyigongcheng",
      iconColor: "--el-color-warning",
      loading: false,
      loadingText: "编译中",
    },
    {
      title: "获取程序集",
      iconBgColor: "--next-color-warning-lighter",
      iconFont: "smom-icon smom-icon-chengxuji",
      iconColor: "--el-color-warning",
      loading: false,
      loadingText: "获取中",
    },
    {
      title: "手动发布",
      iconBgColor: "--next-color-success-lighter",
      iconFont: "smom-icon smom-icon-shangchuanfabu",
      iconColor: "--el-color-success",
      loading: false,
      loadingText: "发布中",
    },
    {
      title: "定时发布",
      iconBgColor: "--next-color-danger-lighter",
      iconFont: "smom-icon smom-icon-duoyuanfabu",
      iconColor: "--el-color-danger",
      loading: false,
      loadingText: "定时发布",
    },
  ],
  // 项目发布信息
  publishData: {
    projectId: null as any,
    projectName: "",
    assemblyOutPath: "",
    environment: 1,
    appconfigData: {} as RowAppconfigType,
  },
});

// 可见功能模块（Task 9：一键发布开关关时过滤掉"一键发布"，origIndex 标记原始下标防止 class 漂移）
const visibleFunModule = computed(() => {
  const withOrig = state.funModule.map((item, origIndex) => ({ ...item, origIndex }));
  return oneClickEnabled.value === 1
    ? withOrig
    : withOrig.filter((f) => f.title !== "一键发布");
});

// 功能模块触发
const currModuleIndex = ref(0);
const onFunModuleHandle = async (index: number) => {
  // index 是 visibleFunModule 的渲染下标，反查原始下标，避免过滤后漂移
  const origIndex = state.funModule.findIndex(
    (f) => f.title === visibleFunModule.value[index].title
  );
  if (origIndex < 0) return;
  let title = state.funModule[origIndex].title;

  // 定时发布直接打开对话框，不需要其他逻辑
  if (title === "定时发布") {
    if (!state.publishData.appconfigData.id) {
      ElMessage.warning("请先选择项目和发布配置！");
      return;
    }
    scheduledPublishDialogRef.value.openDialog({
      projectId: state.publishData.projectId,
      projectName: state.publishData.projectName,
      environment: state.publishData.environment,
      appconfigId: state.publishData.appconfigData.id,
      oneClickEnabled: oneClickEnabled.value,
    });
    return;
  }

  if (showEmptyAppConfig.value) {
    ElMessage.warning("未获取到要发布的应用配置信息！");
    return;
  }
  let currModule = state.funModule.find((item) => item.loading);
  if (currModule) {
    ElMessage.info(`正在[${currModule.title}]中，请稍等！`);
    return;
  }
  onRemoveLogs();
  state.funModule[origIndex].loading = true;
  currModuleIndex.value = origIndex;
  initLogs();
  if (title === "一键发布" || title === "获取程序集" || title === "手动发布") {
    const validateTfsLocalPathResult = await validateTfsLocalPath();
    if (!validateTfsLocalPathResult) {
      state.funModule[origIndex].loading = false;
      return;
    }
  }
  projectAssemblyOutPath.value = await getProjectOutPath();
  switch (title) {
    case "一键发布":
      const oneClickPublishResult = await oneClickPublishing();
      if (oneClickPublishResult) printInfoLog("一键发布成功。");
      break;
    case "编译项目":
      const buildProjectsResult = await buildProjects();
      if (buildProjectsResult)
        printInfoLog("编译项目成功，可以尝试：获取程序集、手动发布。");
      break;
    case "获取程序集":
      const getAppAssemblysResult = await getApplicationAssemblys(true);
      if (getAppAssemblysResult) printInfoLog("获取程序集成功。");
      break;
    case "手动发布":
      const publishResult = await projectPublish();
      if (publishResult) {
        printInfoLog("手动发布成功。");
        await getProjectDefault();
      }
      break;
  }
  printInfoLog("");
  printInfoLog(generatePublishLog.value.logs, "log-info");
  state.funModule[origIndex].loading = false;
  generatePublishLog.value.data = "";
  generatePublishLog.value.logs = "";
};

// 验证TFS本地根目录
const validateTfsLocalPath = async () => {
  if (state.publishData.appconfigData.dllMode !== "TFS") return true;
  if (!state.publishData.appconfigData.dllModeValue) {
    printInfoLog(`当前发布配置使用TFS获取dll，请先配置TFS获取程序集的相关信息.`, "log-error");
    return false;
  }

  const selectTfsItem = JSON.parse(
    state.publishData.appconfigData.dllModeValue
  ) as SelectTfsType;
  const tfsItem = await getTfsDetail(Number(selectTfsItem.id));
  if (tfsItem?.tfsLocalPath) return true;

  printInfoLog(`当前发布配置使用TFS获取dll，请先在TFS配置中填写本地根目录.`, "log-error");
  return false;
};

// 获取项目配置信息
const getConfigItemHosts = () => {
  let projectHosts = [
    {
      hostItem: state.publishData.appconfigData.configItems.webApiHost,
      csprojFile: "SIE.WebApiHost.csproj",
    },
    {
      hostItem: state.publishData.appconfigData.configItems.scheduleServer,
      csprojFile: "SIE.ScheduleServer.csproj",
    },
    {
      hostItem: state.publishData.appconfigData.configItems.webClient,
      csprojFile: "WebClient.csproj",
    },
    {
      hostItem: state.publishData.appconfigData.configItems.spcMonitor,
      csprojFile: "SIE.SpcMonitor.csproj",
    },
    {
      hostItem: state.publishData.appconfigData.configItems.wpfClient,
      csprojFile: "WpfClient.csproj",
    },
  ];
  return projectHosts.filter((item) => item.hostItem.clientPath);
};

// 一健发布
const oneClickPublishing = async () => {
  // 编译项目
  const buildProjectsResult = await buildProjects();
  if (!buildProjectsResult) return false;

  // 发布项目
  const publishResult = await projectPublish();
  if (!publishResult) return false;

  printInfoLog("");
  return true;
};

// 执行获取程序集
const execApplicationAssemblyDone = ref(false);
const onExecApplicationAssembly = async () => {
  if (!state.publishData.appconfigData.id) return false;
  projectAssemblyOutPath.value = await getProjectOutPath();
  const getAppAssemblysResult = await getApplicationAssemblys();
  if (!getAppAssemblysResult) return false;
  execApplicationAssemblyDone.value = true;
  return true;
};

// 执行[获取程序集]完成
const onExecDone = () => {
  execApplicationAssemblyDone.value = false;
};

// 项目发布
const projectPublish = async () => {
  if (!state.publishData.appconfigData.id) return false;
  const getAppAssemblysResult = await getApplicationAssemblys();
  if (!getAppAssemblysResult) return false;

  // 发布前备份
  if (state.publishData.appconfigData.configItems.isBackup == 1) {
    const backupResult = await publishBeforeBackup(state.publishData.appconfigData.id);
    if (!backupResult) return false;
  }

  // 发布 WebApiHost
  const publishWebApiResult = await publishWebApiHost();
  if (!publishWebApiResult) {
    return false;
  }
  // 移除 WebApiHost 服务
  state.publishData.appconfigData.configItems.webApiHost.clientPath = "";

  // 发布 ScheduleServer
  const publishScheduleResult = await publishScheduleServer();
  if (!publishScheduleResult) {
    return false;
  }
  // 移除 ScheduleServer 服务
  state.publishData.appconfigData.configItems.scheduleServer.clientPath = "";

  // 发布 WpfClient
  let publishWpfClientResult = false;
  if (state.publishData.appconfigData.configItems.isNewVersion) {
    publishWpfClientResult = await newPublishWpfClient();
  } else {
    publishWpfClientResult = await publishWpfClient();
  }
  if (!publishWpfClientResult) {
    return false;
  }
  // 移除 WpfClient 服务
  state.publishData.appconfigData.configItems.wpfClient.clientPath = "";

  // 发布 SpcMonitor
  const publishSpcMonitorResult = await publishSpcMonitor();
  if (!publishSpcMonitorResult) {
    return false;
  }
  // 移除 SpcMonitor 服务
  state.publishData.appconfigData.configItems.spcMonitor.clientPath = "";

  // 发布 WebClient
  const publishWebClientResult = await publishWebClient();
  if (!publishWebClientResult) {
    return false;
  }
  // 移除 WebClient 服务
  state.publishData.appconfigData.configItems.webClient.clientPath = "";
  try {
    sendNotification({
      title: "发布完成",
      body: "SMOM项目发布完成！"
    });
  } catch (err) {
    console.error("发送通知失败:", err);
  }
  return true;
};

// 生成发布
const onGeneratePublish = async () => {
  if (!state.publishData.appconfigData.id) return;
  // const appConfigResult = await useAppconfigDb().getAppconfigById(
  //   state.publishData.appconfigData.id
  // );
  // if (appConfigResult.code !== 0) return;
  // generatePublishDialogRef.value.openDialog("edit", appConfigResult.data.data);
  generatePublishDialogRef.value.openDialog("edit", state.publishData.appconfigData);
};

// 发布前备份
const publishBeforeBackup = async (id: number) => {
  var backupItem = await loadBackupItems(id, "发布前备份", false);
  if (!backupItem) return false;
  var backupData = backupItem as RowBackupType;
  printInfoLog("");

  // 备份[WebApiHost]
  if (backupData.backupItems.webApiHost && backupData.backupItems.webApiHost.length > 0) {
    const currLogIndex = printInfoLog(`正在备份 ${webApiHostName.value}.`);
    const backupWebApiHostResult = await backupRemoteServer(
      "WebApiHost",
      backupData.backupItems.webApiHost,
      (uploadFile: UploadFileNumberType) => {
        logPrintInfo.value[currLogIndex].content.uploadFile.prefix = uploadFile.prefix;
        logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
          uploadFile.currNumber;
        logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
          uploadFile.totalNumber;
      }
    );
    if (backupWebApiHostResult.code !== 0) {
      printInfoLog(
        `备份 ${webApiHostName.value} 失败：${backupWebApiHostResult.msg}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`备份 ${webApiHostName.value} 成功.`, "log-success");
  }

  // 备份[ScheduleServer]
  if (
    backupData.backupItems.scheduleServer &&
    backupData.backupItems.scheduleServer.length > 0
  ) {
    const currLogIndex = printInfoLog(`正在备份 ${scheduleServerName.value}.`);
    const backupScheduleServerResult = await backupRemoteServer(
      "ScheduleServer",
      backupData.backupItems.scheduleServer,
      (uploadFile: UploadFileNumberType) => {
        logPrintInfo.value[currLogIndex].content.uploadFile.prefix = uploadFile.prefix;
        logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
          uploadFile.currNumber;
        logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
          uploadFile.totalNumber;
      }
    );
    if (backupScheduleServerResult.code !== 0) {
      printInfoLog(
        `备份 ${scheduleServerName.value} 失败：${backupScheduleServerResult.msg}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`备份 ${scheduleServerName.value} 成功.`, "log-success");
  }

  // 备份[WebClient]
  if (backupData.backupItems.webClient && backupData.backupItems.webClient.length > 0) {
    const currLogIndex = printInfoLog(`正在备份 ${webClientName.value}.`);
    const backupWebClientResult = await backupRemoteServer(
      "WebClient",
      backupData.backupItems.webClient,
      (uploadFile: UploadFileNumberType) => {
        logPrintInfo.value[currLogIndex].content.uploadFile.prefix = uploadFile.prefix;
        logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
          uploadFile.currNumber;
        logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
          uploadFile.totalNumber;
      }
    );
    if (backupWebClientResult.code !== 0) {
      printInfoLog(
        `备份 ${webClientName.value} 失败：${backupWebClientResult.msg}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`备份 ${webClientName.value} 成功.`, "log-success");
  }

  // 备份[WpfClient]
  if (backupData.backupItems.wpfClient && backupData.backupItems.wpfClient.length > 0) {
    const currLogIndex = printInfoLog(`正在备份 ${wpfClientName.value}.`);
    const backupWpfClientResult = await backupRemoteServer(
      "WpfClient",
      backupData.backupItems.wpfClient,
      (uploadFile: UploadFileNumberType) => {
        logPrintInfo.value[currLogIndex].content.uploadFile.prefix = uploadFile.prefix;
        logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
          uploadFile.currNumber;
        logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
          uploadFile.totalNumber;
      },
      Boolean(state.publishData.appconfigData.configItems.isNewVersion)
    );
    if (backupWpfClientResult.code !== 0) {
      printInfoLog(
        `备份 ${wpfClientName.value} 失败：${backupWpfClientResult.msg}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`备份 ${wpfClientName.value} 成功.`, "log-success");
  }

  // 备份[SpcMonitor]
  if (backupData.backupItems.spcMonitor && backupData.backupItems.spcMonitor.length > 0) {
    const currLogIndex = printInfoLog(`正在备份 ${spcMonitorName.value}.`);
    const backupSpcMonitorResult = await backupRemoteServer(
      "SpcMonitor",
      backupData.backupItems.spcMonitor,
      (uploadFileNumber: UploadFileNumberType) => {
        logPrintInfo.value[currLogIndex].content.uploadFile = uploadFileNumber;
      }
    );
    if (backupSpcMonitorResult.code !== 0) {
      printInfoLog(
        `备份 ${spcMonitorName.value} 失败：${backupSpcMonitorResult.msg}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`备份 ${spcMonitorName.value} 成功.`, "log-success");
  }

  let insertResult = await backupDb.insertBackup(backupData);
  if (insertResult.code !== 0) {
    printInfoLog(`备份失败：${insertResult.msg}.`, "log-error");
    return false;
  }
  return true;
};

// 发布[WebApiHost]服务
const publishWebApiHost = async () => {
  const webApiHostItem = state.publishData.appconfigData.configItems.webApiHost;
  if (!webApiHostItem.clientPath) return true;

  printInfoLog("");
  for (let i = 0; i < webApiHostItem.serverArr.length; i++) {
    const webApiServer = webApiHostItem.serverArr[i];
    if (!webApiServer.id) {
      printInfoLog(
        ` ${webApiHostName.value} 未选择服务或该服务器不存在，请检查.`,
        "log-error"
      );
      return false;
    }
    const serverInfo = await getServerDetail(webApiServer.id);
    if (!serverInfo) {
      printInfoLog(`服务[${webApiServer.name}]不存在，请检查.`, "log-error");
      return false;
    }

    // 发布服务
    printInfoLog(`发布 ${webApiHostName.value} 服务[${webApiServer.name}]中，请稍等！`);
    const publishResult = await serverPublish(
      serverInfo,
      webApiServer.serverPathArr,
      webApiHostName.value
    );
    if (!publishResult) return false;
  }
  return true;
};

// 发布[SpcMonitor]服务
const publishSpcMonitor = async () => {
  const spcMonitorItem = state.publishData.appconfigData.configItems.spcMonitor;
  if (!spcMonitorItem.clientPath) return true;

  printInfoLog("");
  for (let i = 0; i < spcMonitorItem.serverArr.length; i++) {
    const spcMonitorServer = spcMonitorItem.serverArr[i];
    if (!spcMonitorServer.id) {
      printInfoLog(
        ` ${spcMonitorName.value} 未选择服务或该服务器不存在，请检查.`,
        "log-error"
      );
      return false;
    }
    const serverInfo = await getServerDetail(spcMonitorServer.id);
    if (!serverInfo) {
      printInfoLog(`服务[${spcMonitorServer.name}]不存在，请检查.`, "log-error");
      return false;
    }

    // 发布服务
    printInfoLog(
      `发布 ${spcMonitorName.value} 服务[${spcMonitorServer.name}]中，请稍等！`
    );
    const publishResult = await serverPublish(
      serverInfo,
      spcMonitorServer.serverPathArr,
      spcMonitorName.value
    );
    if (!publishResult) return false;
  }
  return true;
};

// 发布[WebClient]服务
const publishWebClient = async () => {
  const webClientItem = state.publishData.appconfigData.configItems.webClient;
  if (!webClientItem.clientPath) return true;

  printInfoLog("");
  for (let i = 0; i < webClientItem.serverArr.length; i++) {
    const webClientServer = webClientItem.serverArr[i];
    if (!webClientServer.id) {
      printInfoLog(
        ` ${webClientName.value} 未选择服务或该服务器不存在，请检查.`,
        "log-error"
      );
      return false;
    }
    const serverInfo = await getServerDetail(webClientServer.id);
    if (!serverInfo) {
      printInfoLog(`服务[${webClientServer.name}]不存在，请检查.`, "log-error");
      return false;
    }

    // 发布服务
    printInfoLog(`发布 ${webClientName.value} 服务[${webClientServer.name}]中，请稍等！`);
    const publishResult = await serverPublish(
      serverInfo,
      webClientServer.serverPathArr,
      webClientName.value
    );
    if (!publishResult) return false;
  }
  return true;
};

// 发布[ScheduleServer]服务
const publishScheduleServer = async () => {
  const scheduleServerItem = state.publishData.appconfigData.configItems.scheduleServer;
  if (!scheduleServerItem.clientPath) return true;

  printInfoLog("");

  for (let i = 0; i < scheduleServerItem.serverArr.length; i++) {
    const scheduleServer = scheduleServerItem.serverArr[i];
    if (!scheduleServer.id) {
      printInfoLog(
        ` ${scheduleServerName.value} 未选择服务或该服务器不存在，请检查.`,
        "log-error"
      );
      return false;
    }
    const serverInfo = await getServerDetail(scheduleServer.id);
    if (!serverInfo) {
      printInfoLog(`服务[${scheduleServer.name}]不存在，请检查.`, "log-error");
      return false;
    }

    // 发布服务
    printInfoLog(`发布 ${scheduleServerName.value} 服务[${scheduleServer.name}]中，请稍等！`);

    for (let j = 0; j < scheduleServer.serverPathArr.length; j++) {
      const serverPath = scheduleServer.serverPathArr[j];
      if (!serverPath.value) {
        printInfoLog(`服务[${scheduleServer.name}]未配置，请检查.`, "log-error");
        return false;
      }

      for (let k = 0; k < serverPath.value.length; k++) {
        const serverPathVal = serverPath.value[k];
        if (!serverPathVal.identity) {
          printInfoLog(`服务[${scheduleServer.name}]未填写服务标识，请检查.`, "log-error");
          return false;
        }
        if (!serverPathVal.path) {
          printInfoLog(`服务[${scheduleServer.name}]未填写服务发布路径，请检查.`, "log-error");
          return false;
        }

        const uName = serverInfo.account;
        const uPwd = serverInfo.pwd;
        const serverAddress = `${serverInfo.ip}:${serverInfo.port}`;

        /* 1.关闭服务 */
        printInfoLog(`正在关闭 ${scheduleServerName.value} 服务.`);
        let closeServiceResult;
        if (serverInfo.os === 1) {
          closeServiceResult = await switchWinService(
            uName,
            uPwd,
            serverAddress,
            serverPathVal.identity,
            "stop"
          );
        } else if (serverInfo.os === 2) {
          closeServiceResult = await switchDockerService(
            uName,
            uPwd,
            serverAddress,
            serverPathVal.identity,
            "stop"
          );
        } else {
          printInfoLog(
            `未找到 ${displayOs(Number(serverInfo.os))} 部署环境，请检查.`,
            "log-error"
          );
          return false;
        }
        if (!closeServiceResult) {
          printInfoLog(`服务 ${scheduleServerName.value} 关闭失败.`, "log-error");
          return false;
        }
        printInfoLog(`服务 ${scheduleServerName.value} 已关闭.`, "log-success");

        /* 上传文件到服务器 */
        const currLogIndex = printInfoLog(`服务 ${scheduleServerName.value} 正在发布.`);

        // 获取项目输出路径
        let localPath = projectAssemblyOutPath.value + "/" + scheduleServerName.value;
        const remotePath = removeSlash(serverPathVal.path);
        const projectFiles = await readDirFiles(localPath);
        if (projectFiles.length < 1) {
          printInfoLog(
            `未获取到 ${scheduleServerName.value} 项目的程序集文件，可点击【获取程序集】进行排查.`,
            "log-warning"
          );
          // return false;
        }
        let uploadFileNumber: UploadFileNumberType = {
          currNumber: 0,
          totalNumber: projectFiles.length,
          prefix: "已上传：",
        };
        // let localFiles = new Array();
        // let remoteFiles = new Array();
        for (let l = 0; l < projectFiles.length; l++) {
          const projectFile = projectFiles[l];
          // localFiles.push(`${localPath}/${projectFile}`);
          // remoteFiles.push(`${remotePath}/${projectFile}`);
          const uploadServerFileResult = await uploadServerFilesWithRetry({
            localPaths: [`${localPath}/${projectFile}`],
            remotePaths: [`${remotePath}/${projectFile}`],
            username: uName,
            password: uPwd,
            server: serverAddress,
          });
          if (uploadServerFileResult.code !== 0) {
            printInfoLog(
              `服务 ${scheduleServerName.value} 发布失败：${uploadServerFileResult.data}.`,
              "log-error"
            );
            return false;
          }
          uploadFileNumber.currNumber++;
          logPrintInfo.value[currLogIndex].content.uploadFile.prefix = uploadFileNumber.prefix;
          logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
            uploadFileNumber.currNumber;
          logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
            uploadFileNumber.totalNumber;
        }

        printInfoLog(
          `已将 ${projectFiles.length} 个文件上传到 ${scheduleServerName.value} 服务器.`,
          "log-success"
        );
        printInfoLog(`服务 ${scheduleServerName.value} 正在启动.`);
        let startServiceResult;
        if (serverInfo.os === 1) {
          startServiceResult = await switchWinService(
            uName,
            uPwd,
            serverAddress,
            serverPathVal.identity,
            "start"
          );
        } else if (serverInfo.os === 2) {
          startServiceResult = await switchDockerService(
            uName,
            uPwd,
            serverAddress,
            serverPathVal.identity,
            "start"
          );
        }
        if (!startServiceResult) {
          printInfoLog(`服务 ${scheduleServerName.value} 启动失败.`, "log-error");
          return false;
        }
        printInfoLog(`服务 ${scheduleServerName.value} 发布成功.`, "log-success");
      }
    }
  }
  return true;
};

// [新]发布[WpfClient]服务
const newPublishWpfClient = async () => {
  const wpfClientItem = state.publishData.appconfigData.configItems.wpfClient;
  if (!wpfClientItem.clientPath) return true;

  printInfoLog("");
  printInfoLog(
    `发布 ${wpfClientName.value} 服务[${wpfClientItem.serverName}]中，请稍等！`
  );

  // 获取[生成目录]
  let generateDirs = new Array<string>();
  if (!wpfClientItem.generateDirJson) {
    printInfoLog(`服务[${wpfClientName.value}]未配置[生成目录]，请检查.`, "log-error");
    return false;
  }
  generateDirs = JSON.parse(wpfClientItem.generateDirJson);

  // 创建一个临时发布目录
  const tempPublishDir = `${projectAssemblyOutPath.value}/${wpfClientName.value}/tempPublish`;
  const tempPublishDirExists = await cmdInvoke("exists", {
    path: tempPublishDir,
  });
  if (tempPublishDirExists.code === 0) {
    await cmdInvoke("delete_paths", {
      paths: [tempPublishDir],
    });
  }
  let createTempPathResult = await createDir(tempPublishDir);
  if (!createTempPathResult) {
    printInfoLog(`创建临时发布目录失败：${tempPublishDir}`, "log-error");
    return false;
  }

  // 获取[远程服务器]信息
  const serverId = wpfClientItem.serverId;
  const serverPath = wpfClientItem.serverPath;
  const serverName = wpfClientItem.serverName;
  if (!serverId) {
    printInfoLog(
      ` ${wpfClientName.value} 未选择服务或该服务器不存在，请检查.`,
      "log-error"
    );
    return false;
  }
  const serverInfo = await getServerDetail(serverId);
  if (!serverInfo) {
    printInfoLog(`服务[${wpfClientName.value}]不存在，请检查.`, "log-error");
    return false;
  }

  if (!serverPath) {
    printInfoLog(`服务[${wpfClientName.value}]未填写服务发布路径，请检查.`, "log-error");
    return false;
  }
  const uName = serverInfo.account;
  const uPwd = serverInfo.pwd;
  const serverAddress = `${serverInfo.ip}:${serverInfo.port}`;

  // 从远程服务器下载文件到[临时缓存目录]
  let remoteFiles = [`${removeSlash(serverPath)}/Manifest.xml`];
  for (let i = 0; i < generateDirs.length; i++) {
    const generateDir = generateDirs[i];
    remoteFiles.push(`${removeSlash(serverPath)}/${generateDir}.zip`);
  }
  let localFiles = new Array<string>();
  let remoteFileNames = new Array<string>();
  for (let i = 0; i < remoteFiles.length; i++) {
    const remoteFile = remoteFiles[i];
    const subStartIndex = remoteFile.lastIndexOf("/");
    const remoteFileName = remoteFile.substring(subStartIndex + 1);
    remoteFileNames.push(remoteFileName);
    const localFile = `${tempPublishDir}/${remoteFileName}`;
    localFiles.push(localFile);
  }
  printInfoLog(`正在获取远程服务文件：${remoteFileNames.join("、")}`);
  const downloadServerFileResult = await cmdInvoke("download_server_files", {
    username: uName,
    password: uPwd,
    server: serverAddress,
    remotePaths: remoteFiles,
    localPaths: localFiles,
  });

  if (downloadServerFileResult.code !== 0) {
    printInfoLog(
      `获取远程服务文件失败：[${downloadServerFileResult.data}].`,
      "log-error"
    );
    return false;
  }
  printInfoLog(`获取远程服务文件成功.`, "log-success");

  // 处理下载文件
  for (let i = 0; i < localFiles.length; i++) {
    const localFile = localFiles[i];
    const lastIndex = localFile.lastIndexOf("/");
    // 判断是否为zip文件
    const fileName = `${localFile.substring(lastIndex + 1)}`;
    if (!fileName.endsWith(".zip")) continue;

    // 进行解压
    let unzipPath = removeSlash(`${localFile.substring(0, lastIndex + 1)}`);
    printInfoLog(`正在解压 ${fileName}.`);
    const dirName = fileName.replace(".zip", "");
    if (fileName == "Plugins.zip" || fileName == "Lib.zip") {
      unzipPath = `${unzipPath}/${dirName}`;
    }

    const unzipResult = await cmdInvoke("un_zip", {
      filePaths: [localFile],
      destination: unzipPath,
    });
    if (unzipResult.code !== 0) {
      printInfoLog(`解压 ${fileName} 失败：${unzipResult.data}.`, "log-error");
      return false;
    }
    printInfoLog(`解压 ${fileName} 成功.`, "log-success");

    // 将压缩文件删除
    await cmdInvoke("delete_paths", {
      paths: [localFile],
    });

    // 将生成的文件复制到[临时发布目录]
    let sourcePath = `${removeSlash(wpfClientItem.clientPath)}/${dirName}`;
    let destinationPath = `${removeSlash(tempPublishDir)}/${dirName}`;
    const copyResult = await cmdInvoke("copy_path", {
      source: sourcePath,
      destination: destinationPath,
    });
    if (copyResult.code !== 0) {
      printInfoLog(`复制文件目录 ${sourcePath} 失败.`, "log-error");
      return false;
    }

    // 重新打包压缩
    printInfoLog(
      `正在将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")}服务器.`
    );

    let compresseResult;
    if (dirName == "Plugins" || dirName == "Lib") {
      compresseResult = await cmdInvoke("zip_dir", {
        srcDir: destinationPath,
        dstFile: `${removeSlash(tempPublishDir)}/${dirName}.zip`,
      });
    } else {
      compresseResult = await cmdInvoke("compress_zip", {
        filePaths: [destinationPath],
        dstFile: `${removeSlash(tempPublishDir)}/${dirName}.zip`,
      });
    }

    if (compresseResult.code !== 0) {
      printInfoLog(`压缩[${dirName}.zip]失败：${compresseResult.data}.`, "log-error");
      return false;
    }

    // 压缩成功后重新上传到服务器
    const uploadFileResult = await cmdInvoke("upload_server_files", {
      localPaths: [`${removeSlash(tempPublishDir)}/${dirName}.zip`],
      remotePaths: [`${removeSlash(serverPath)}/${dirName}.zip`],
      username: uName,
      password: uPwd,
      server: serverAddress,
    });
    if (uploadFileResult.code !== 0) {
      printInfoLog(`文件 ${dirName}.zip 上传失败.`, "log-error");
      return false;
    }
    printInfoLog(
      `已将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")} 服务器.`,
      "log-success"
    );

    // 升级版本号
    printInfoLog(`正在更新 ${dirName}.zip 版本号.`);
    const localManifestFile =
      removeSlash(localFile.substring(0, lastIndex + 1)) + "/Manifest.xml";
    const upgradePluginsVersionResult = await cmdInvoke("upgrade_module_version", {
      filePath: localManifestFile,
      moduleName: dirName,
    });
    if (upgradePluginsVersionResult.code !== 0) {
      printInfoLog(
        `更新 ${dirName}.zip 版本号失败：${upgradePluginsVersionResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(
      `已将 ${dirName}.zip 版本号更新为 ${upgradePluginsVersionResult.data}.`,
      "log-success"
    );

    // 将本地 Manifest.xml 上传到服务器
    const remoteManifestPath = `${removeSlash(serverPath)}/Manifest.xml`;
    const uploadManifestFileResult = await cmdInvoke("upload_server_files", {
      localPaths: [localManifestFile],
      remotePaths: [remoteManifestPath],
      username: uName,
      password: uPwd,
      server: serverAddress,
    });
    if (uploadManifestFileResult.code !== 0) {
      printInfoLog(
        `文件 ${dirName}.zip 上传失败：${uploadManifestFileResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`已成功更新 ${dirName}.zip 版本号.`, "log-success");
  }

  // 发布成功，删除临时文件
  await cmdInvoke("delete_paths", {
    paths: [tempPublishDir],
  });
  return true;
};

// 发布[WpfClient]服务
const publishWpfClient = async () => {
  const wpfClientItem = state.publishData.appconfigData.configItems.wpfClient;
  if (!wpfClientItem.clientPath) return true;

  printInfoLog("");
  printInfoLog(
    `发布 ${wpfClientName.value} 服务[${wpfClientItem.serverName}]中，请稍等！`
  );

  // 获取[生成目录]
  let generateDirs = new Array<string>();
  if (!wpfClientItem.generateDirJson) {
    printInfoLog(`服务[${wpfClientName.value}]未配置[生成目录]，请检查.`, "log-error");
    return false;
  }
  generateDirs = JSON.parse(wpfClientItem.generateDirJson);

  // 创建一个临时发布目录
  const tempPublishDir = `${projectAssemblyOutPath.value}/${wpfClientName.value}/tempPublish`;
  const tempPublishDirExists = await cmdInvoke("exists", {
    path: tempPublishDir,
  });
  if (tempPublishDirExists.code === 0) {
    await cmdInvoke("delete_paths", {
      paths: [tempPublishDir],
    });
  }
  let createTempPathResult = await createDir(tempPublishDir);
  if (!createTempPathResult) {
    printInfoLog(`创建临时发布目录失败：${tempPublishDir}`, "log-error");
    return false;
  }

  // 获取[远程服务器]信息
  const serverId = wpfClientItem.serverId;
  const serverPath = wpfClientItem.serverPath;
  const serverName = wpfClientItem.serverName;
  if (!serverId) {
    printInfoLog(
      ` ${wpfClientName.value} 未选择服务或该服务器不存在，请检查.`,
      "log-error"
    );
    return false;
  }
  const serverInfo = await getServerDetail(serverId);
  if (!serverInfo) {
    printInfoLog(`服务[${wpfClientName.value}]不存在，请检查.`, "log-error");
    return false;
  }

  if (!serverPath) {
    printInfoLog(`服务[${wpfClientName.value}]未填写服务发布路径，请检查.`, "log-error");
    return false;
  }
  const uName = serverInfo.account;
  const uPwd = serverInfo.pwd;
  const serverAddress = `${serverInfo.ip}:${serverInfo.port}`;

  // 从远程服务器下载文件到[临时缓存目录]
  let remoteFiles = [`${removeSlash(serverPath)}/Manifest.xml`];
  if (generateDirs.includes("Domain") || generateDirs.includes("UI")) {
    remoteFiles.push(`${removeSlash(serverPath)}/Plugins.zip`);
  }
  for (let i = 0; i < generateDirs.length; i++) {
    const generateDir = generateDirs[i];
    if (generateDir == "Domain" || generateDir == "UI") continue;
    remoteFiles.push(`${removeSlash(serverPath)}/${generateDir}.zip`);
  }
  let localFiles = new Array<string>();
  let remoteFileNames = new Array<string>();
  for (let i = 0; i < remoteFiles.length; i++) {
    const remoteFile = remoteFiles[i];
    const subStartIndex = remoteFile.lastIndexOf("/");
    const remoteFileName = remoteFile.substring(subStartIndex + 1);
    remoteFileNames.push(remoteFileName);
    const localFile = `${tempPublishDir}/${remoteFileName}`;
    localFiles.push(localFile);
  }
  printInfoLog(`正在获取远程服务文件：${remoteFileNames.join("、")}`);
  const downloadServerFileResult = await cmdInvoke("download_server_files", {
    username: uName,
    password: uPwd,
    server: serverAddress,
    remotePaths: remoteFiles,
    localPaths: localFiles,
  });

  if (downloadServerFileResult.code !== 0) {
    printInfoLog(
      `获取远程服务文件失败：[${downloadServerFileResult.data}].`,
      "log-error"
    );
    return false;
  }
  printInfoLog(`获取远程服务文件成功.`, "log-success");

  // 处理下载文件
  for (let i = 0; i < localFiles.length; i++) {
    const localFile = localFiles[i];
    const lastIndex = localFile.lastIndexOf("/");
    // 判断是否为zip文件
    const fileName = `${localFile.substring(lastIndex + 1)}`;
    if (!fileName.endsWith(".zip")) continue;

    // 进行解压
    const unzipPath = removeSlash(`${localFile.substring(0, lastIndex + 1)}`);
    printInfoLog(`正在解压 ${fileName}.`);
    const unzipResult = await cmdInvoke("un_zip", {
      filePaths: [localFile],
      destination: unzipPath,
    });
    if (unzipResult.code !== 0) {
      printInfoLog(`解压 ${fileName} 失败：${unzipResult.data}.`, "log-error");
      return false;
    }
    printInfoLog(`解压 ${fileName} 成功.`, "log-success");

    // 将压缩文件删除
    await cmdInvoke("delete_paths", {
      paths: [localFile],
    });

    // 将生成的文件复制到[临时发布目录]
    const dirName = fileName.replace(".zip", "");
    if (dirName == "Plugins") {
      // Domain
      const sourceDomainPath = `${removeSlash(wpfClientItem.clientPath)}/Domain`;
      const destinationDomainPath = `${removeSlash(tempPublishDir)}/Domain`;
      const copyDomainResult = await cmdInvoke("copy_path", {
        source: sourceDomainPath,
        destination: destinationDomainPath,
      });
      if (copyDomainResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourceDomainPath} 失败.`, "log-error");
        return false;
      }

      // UI
      const sourceUiPath = `${removeSlash(wpfClientItem.clientPath)}/UI`;
      const destinationUiPath = `${removeSlash(tempPublishDir)}/UI`;
      const copyUiResult = await cmdInvoke("copy_path", {
        source: sourceUiPath,
        destination: destinationUiPath,
      });
      if (copyUiResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourceUiPath} 失败.`, "log-error");
        return false;
      }

      // 重新打包压缩
      const compressePluginsResult = await cmdInvoke("compress_zip", {
        filePaths: [destinationDomainPath, destinationUiPath],
        dstFile: `${removeSlash(tempPublishDir)}/Plugins.zip`,
      });
      if (compressePluginsResult.code !== 0) {
        printInfoLog(
          `压缩[Plugins.zip]失败：${compressePluginsResult.data}.`,
          "log-error"
        );
        return false;
      }

      // 压缩成功后重新上传到服务器
      printInfoLog(
        `正在将 Plugins.zip 文件上传到 ${serverName?.replace("服务器", "")}服务器.`
      );
      const uploadPluginsFileResult = await cmdInvoke("upload_server_files", {
        localPaths: [`${removeSlash(tempPublishDir)}/Plugins.zip`],
        remotePaths: [`${removeSlash(serverPath)}/Plugins.zip`],
        username: uName,
        password: uPwd,
        server: serverAddress,
      });
      if (uploadPluginsFileResult.code !== 0) {
        printInfoLog(`文件 Plugins.zip 上传失败.`, "log-error");
        return false;
      }
      printInfoLog(
        `已将 Plugins.zip 文件上传到 ${serverName?.replace("服务器", "")}服务器.`,
        "log-success"
      );
    } else {
      let sourcePath = `${removeSlash(wpfClientItem.clientPath)}/${dirName}`;
      let destinationPath = `${removeSlash(tempPublishDir)}/${dirName}`;
      const copyResult = await cmdInvoke("copy_path", {
        source: sourcePath,
        destination: destinationPath,
      });
      if (copyResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourcePath} 失败.`, "log-error");
        return false;
      }

      // 重新打包压缩
      printInfoLog(
        `正在将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")}服务器.`
      );
      const compresseResult = await cmdInvoke("compress_zip", {
        filePaths: [destinationPath],
        dstFile: `${removeSlash(tempPublishDir)}/${dirName}.zip`,
      });
      if (compresseResult.code !== 0) {
        printInfoLog(`压缩[${dirName}.zip]失败：${compresseResult.data}.`, "log-error");
        return false;
      }

      // 压缩成功后重新上传到服务器
      const uploadFileResult = await cmdInvoke("upload_server_files", {
        localPaths: [`${removeSlash(tempPublishDir)}/${dirName}.zip`],
        remotePaths: [`${removeSlash(serverPath)}/${dirName}.zip`],
        username: uName,
        password: uPwd,
        server: serverAddress,
      });
      if (uploadFileResult.code !== 0) {
        printInfoLog(`文件 ${dirName}.zip 上传失败.`, "log-error");
        return false;
      }
      printInfoLog(
        `已将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")} 服务器.`,
        "log-success"
      );
    }

    // 升级版本号
    printInfoLog(`正在更新 ${dirName}.zip 版本号.`);
    const localManifestFile =
      removeSlash(localFile.substring(0, lastIndex + 1)) + "/Manifest.xml";
    const upgradePluginsVersionResult = await cmdInvoke("upgrade_module_version", {
      filePath: localManifestFile,
      moduleName: dirName,
    });
    if (upgradePluginsVersionResult.code !== 0) {
      printInfoLog(
        `更新 ${dirName}.zip 版本号失败：${upgradePluginsVersionResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(
      `已将 ${dirName}.zip 版本号更新为 ${upgradePluginsVersionResult.data}.`,
      "log-success"
    );

    // 将本地 Manifest.xml 上传到服务器
    const remoteManifestPath = `${removeSlash(serverPath)}/Manifest.xml`;
    const uploadManifestFileResult = await cmdInvoke("upload_server_files", {
      localPaths: [localManifestFile],
      remotePaths: [remoteManifestPath],
      username: uName,
      password: uPwd,
      server: serverAddress,
    });
    if (uploadManifestFileResult.code !== 0) {
      printInfoLog(
        `文件 ${dirName}.zip 上传失败：${uploadManifestFileResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`已成功更新 ${dirName}.zip 版本号.`, "log-success");
  }

  // 发布成功，删除临时文件
  await cmdInvoke("delete_paths", {
    paths: [tempPublishDir],
  });
  return true;
};

// 发布服务
const serverPublish = async (
  server: RowServerType,
  serverPathArr: ServerOptionType[],
  serverName: string
) => {
  for (let j = 0; j < serverPathArr.length; j++) {
    const serverPath = serverPathArr[j];
    if (!serverPath.value) {
      printInfoLog(`服务[${server.name}]未配置，请检查.`, "log-error");
      return false;
    }
    for (let k = 0; k < serverPath.value.length; k++) {
      const serverPathVal = serverPath.value[k];
      if (!serverPathVal.identity) {
        printInfoLog(`服务[${server.name}]未填写服务标识，请检查.`, "log-error");
        return false;
      }
      if (!serverPathVal.path) {
        printInfoLog(`服务[${server.name}]未填写服务发布路径，请检查.`, "log-error");
        return false;
      }
      const uName = server.account;
      const uPwd = server.pwd;
      const serverAddress = `${server.ip}:${server.port}`;

      /* 1.关闭服务 */
      printInfoLog(`正在关闭 ${serverName} 服务.`);
      let closeServiceResult;
      if (server.os === 1) {
        closeServiceResult = await switchWinService(
          uName,
          uPwd,
          serverAddress,
          serverPathVal.identity,
          "stop"
        );
      } else if (server.os === 2) {
        closeServiceResult = await switchDockerService(
          uName,
          uPwd,
          serverAddress,
          serverPathVal.identity,
          "stop"
        );
      } else {
        printInfoLog(
          `未找到 ${displayOs(Number(server.os))} 部署环境，请检查.`,
          "log-error"
        );
        return false;
      }
      if (!closeServiceResult) {
        printInfoLog(`服务 ${serverName} 关闭失败.`, "log-error");
        return false;
      }
      printInfoLog(`服务 ${serverName} 已关闭.`, "log-success");

      /* 上传文件到服务器 */
      const currLogIndex = printInfoLog(`服务 ${serverName} 正在发布.`);

      // 获取项目输出路径
      let localPath = projectAssemblyOutPath.value + "/" + serverName;
      const remotePath = removeSlash(serverPathVal.path);
      const projectFiles = await readDirFiles(localPath);
      if (projectFiles.length < 1) {
        printInfoLog(
          `未获取到 ${serverName} 项目的程序集文件，可点击【获取程序集】排查.`,
          "log-warning"
        );
        // return;
      }
      let uploadFileNumber: UploadFileNumberType = {
        currNumber: 0,
        totalNumber: projectFiles.length,
        prefix: "已上传：",
      };
      for (let l = 0; l < projectFiles.length; l++) {
        const projectFile = projectFiles[l];
        const uploadServerFileResult = await uploadServerFilesWithRetry({
          localPaths: [`${localPath}/${projectFile}`],
          remotePaths: [`${remotePath}/${projectFile}`],
          username: uName,
          password: uPwd,
          server: serverAddress,
        });
        if (uploadServerFileResult.code !== 0) {
          printInfoLog(
            `服务 ${serverName} 发布失败：${uploadServerFileResult.data}.`,
            "log-error"
          );
          return false;
        }
        uploadFileNumber.currNumber++;
        logPrintInfo.value[currLogIndex].content.uploadFile.prefix =
          uploadFileNumber.prefix;
        logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
          uploadFileNumber.currNumber;
        logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
          uploadFileNumber.totalNumber;
      }
      printInfoLog(
        `已将 ${projectFiles.length} 个文件上传到 ${serverName}服务器.`,
        "log-success"
      );
      printInfoLog(`服务 ${serverName} 正在启动.`);
      let startServiceResult;
      if (server.os === 1) {
        startServiceResult = await switchWinService(
          uName,
          uPwd,
          serverAddress,
          serverPathVal.identity,
          "start"
        );
      } else if (server.os === 2) {
        startServiceResult = await switchDockerService(
          uName,
          uPwd,
          serverAddress,
          serverPathVal.identity,
          "start"
        );
      }
      if (!startServiceResult) {
        printInfoLog(`服务 ${serverName} 启动失败.`, "log-error");
        return false;
      }
      printInfoLog(`服务 ${serverName} 发布成功.`, "log-success");
    }
  }
  return true;
};

// 切换Windows服务
const switchWinService = async (
  username: string,
  password: string,
  server: string,
  serviceName: string,
  action: "stop" | "start"
) => {
  const isStop = await isWinServiceStop(username, password, server, serviceName);
  if (action == "stop" && isStop) return true;
  if (action == "start" && !isStop) return true;

  // 使用 sc stop/start 代替 net stop/start，避免 SSH 会话中执行不彻底的问题
  const switchServerResult = await cmdInvoke("execute_remote_command", {
    username,
    password,
    server,
    command: `sc ${action} "${serviceName}"`,
  });
  if (switchServerResult.code !== 0) {
    printInfoLog(switchServerResult.data, "log-error");
    return false;
  }

  // 轮询等待服务达到目标状态（sc 命令为非阻塞，需轮询确认），
  // 避免服务句柄未释放就复制文件导致文件锁定失败
  // 最多等待 5 分钟：150 次 × 2s = 300s
  const maxRetries = 150;
  const retryInterval = 2000;
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((resolve) => setTimeout(resolve, retryInterval));
    const stopped = await isWinServiceStop(username, password, server, serviceName);
    if (action === "stop" && stopped) return true;
    if (action === "start" && !stopped) return true;
  }

  printInfoLog(
    `服务 ${serviceName} ${action === "stop" ? "关闭" : "启动"}超时，请手动检查.`,
    "log-warning"
  );
  return false;
};

// 上传文件到服务器（带重试）：服务停止后进程可能仍短暂持有文件句柄，
// 导致 SCP 覆盖 dll/exe 失败；失败后等待并重试，给进程退出留出时间
const uploadServerFilesWithRetry = async (
  args: {
    localPaths: string[];
    remotePaths: string[];
    username: string;
    password: string;
    server: string;
  },
  maxRetries = 100,
  intervalMs = 3000
) => {
  let result = await cmdInvoke("upload_server_files", args);
  for (let attempt = 1; attempt < maxRetries; attempt++) {
    if (result.code === 0) return result;
    printInfoLog(
      `文件上传失败，${intervalMs / 1000}s 后重试 (${attempt}/${maxRetries})：${result.data}`,
      "log-warning"
    );
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    result = await cmdInvoke("upload_server_files", args);
  }
  return result;
};

// 切换Docker服务
const switchDockerService = async (
  username: string,
  password: string,
  server: string,
  serviceName: string,
  action: "stop" | "start"
) => {
  const switchServerResult = await cmdInvoke("execute_remote_command", {
    username,
    password,
    server,
    command: `docker ${action} ${serviceName}`,
  });
  if (switchServerResult.code !== 0) printInfoLog(switchServerResult.data, "log-error");
  return switchServerResult.code === 0;
};

// 验证[Windows]服务是否已关闭
const isWinServiceStop = async (
  username: string,
  password: string,
  server: string,
  serviceName: string
) => {
  const invokeResult = await cmdInvoke<string>("execute_remote_command", {
    username,
    password,
    server,
    command: `sc query "${serviceName}"`,
  });
  if (invokeResult.data.includes("STOPPED")) {
    return true;
  }
  return false;
};

// 读取目录中的文件
const readDirFiles = async (dirPath: string) => {
  const readFilesResult = await cmdInvoke("read_files", { path: dirPath });
  if (readFilesResult.code !== 0) {
    printInfoLog(readFilesResult.data, "log-error");
    return [];
  }
  return readFilesResult.data as string[];
};

// 打开程序集输出路径
const onOpenAssemblyOutPath = async (path: string) => {
  if (!path) return;
  await cmdInvoke("open_dir", { path });
};

// 打开客户端生成路径
const onOpenClientPath = async (path: string) => {
  if (!path) return;
  await cmdInvoke("open_dir", { path });
};

// 编译项目
const buildProjects = async () => {
  // MSBuild编译
  let msBuildPath = removeSlash(String(state.publishData.appconfigData.msBuildPath));
  let isRebuild = state.publishData.appconfigData.configItems.isRebuild == 1;
  if (!msBuildPath) {
    printInfoLog("[MsBuild路径]不能为空，请检查.", "log-error");
    return false;
  }
  const msBuildPathExists = await cmdInvoke("exists", {
    path: msBuildPath,
  });
  if (msBuildPathExists.code !== 0) {
    printInfoLog(`"MsBuild路径[${msBuildPath}]不存在，请检查.`, "log-error");
    return false;
  }

  // 项目配置信息
  let projectHosts = getConfigItemHosts();
  let isSuccess = true;
  for (let i = 0; i < projectHosts.length; i++) {
    const projectHost = projectHosts[i];
    if (!projectHost.hostItem.clientPath) continue;

    // 删除生成目录
    const clientPathExists = await cmdInvoke("exists", {
      path: projectHost.hostItem.clientPath,
    });
    if (clientPathExists.code === 0) {
      await cmdInvoke("delete_paths", {
        paths: [projectHost.hostItem.clientPath],
      });
    }

    // 编译中
    printInfoLog(`正在编译 ${projectHost.csprojFile} 项目.`);
    let clientPath = projectHost.hostItem.clientPath.split("bin")[0];
    let webApiHostPath = `${removeSlash(clientPath)}/${projectHost.csprojFile}`;
    const buildResult = await cmdInvoke("build_project_release", {
      projectFilePath: webApiHostPath,
      msbuildPath: msBuildPath,
      isRebuild,
      buildMode: state.publishData.appconfigData.buildMode || "Release",
    });

    // 编译结果
    if (buildResult.code === 0) {
      printInfoLog(`编译 ${projectHost.csprojFile} 成功.`, "log-success");
    } else {
      printInfoLog(
        `编译 ${projectHost.csprojFile} 失败：${buildResult.data}`,
        "log-error"
      );
      isSuccess = false;
    }
  }

  printInfoLog("编译项目结束。");

  return isSuccess;
};

// 获取项目输出路径
const getProjectOutPath = async () => {
  let projectOutPath = "";
  let assemblyOutPath = projectList.value?.find(
    (item) => item.id === state.publishData.projectId
  )?.assemblyOutPath;
  if (assemblyOutPath) {
    projectOutPath = assemblyOutPath;
  } else {
    projectOutPath = `${await path.appLocalDataDir()}`;
    printInfoLog(
      `未配置程序集输出路径，将采用默认路径：${projectOutPath}`,
      "log-warning"
    );
  }
  return `${removeSlash(projectOutPath)}/${state.publishData.projectName
    }/${displayEnvironment(state.publishData.environment)}`;
};

// 获取应用程序集
const getApplicationAssemblys = async (isOpenDir: boolean = false) => {
  // 获取项目输出路径
  let projectOutPath = projectAssemblyOutPath.value;
  let isSuccess = true;
  printInfoLog("");
  // 获取[WebApiHost]应用程序集
  if (state.publishData.appconfigData.configItems.webApiHost.clientPath) {
    const copyWebApiResult = await copyAssemblyFile(
      "WebApiHost",
      projectOutPath,
      state.publishData.appconfigData.configItems.webApiHost
    );
    isSuccess = copyWebApiResult;
  }

  // 获取[ScheduleServer]应用程序集
  if (state.publishData.appconfigData.configItems.scheduleServer.clientPath) {
    const copyScheduleServerResult = await copyAssemblyFile(
      "ScheduleServer",
      projectOutPath,
      state.publishData.appconfigData.configItems.scheduleServer
    );
    if (!copyScheduleServerResult) isSuccess = false;
  }

  // 获取[WebClient]应用程序集
  if (state.publishData.appconfigData.configItems.webClient.clientPath) {
    const copyWebClientResult = await copyAssemblyFile(
      "WebClient",
      projectOutPath,
      state.publishData.appconfigData.configItems.webClient
    );
    if (!copyWebClientResult) isSuccess = false;
  }

  // 获取[SpcMonitor]应用程序集
  if (state.publishData.appconfigData.configItems.spcMonitor.clientPath) {
    const copySpcMonitorResult = await copyAssemblyFile(
      "SpcMonitor",
      projectOutPath,
      state.publishData.appconfigData.configItems.spcMonitor
    );
    if (!copySpcMonitorResult) isSuccess = false;
  }

  // 获取[WpfClient]应用程序集
  if (state.publishData.appconfigData.configItems.wpfClient.clientPath) {
    let copyWpfClientResult = false;
    if (state.publishData.appconfigData.configItems.isNewVersion) {
      // 新版
      copyWpfClientResult = await newCopyWpfAssemblyFile(
        projectOutPath,
        state.publishData.appconfigData.configItems.wpfClient
      );
    } else {
      // 旧版
      copyWpfClientResult = await copyWpfAssemblyFile(
        projectOutPath,
        state.publishData.appconfigData.configItems.wpfClient
      );
    }

    if (!copyWpfClientResult) isSuccess = false;
  }

  printInfoLog("获取程序集结束。");

  // DLL名称模式下生成发布日志
  if (state.publishData.appconfigData.dllMode == "DLL名称" && generatePublishLog.value.isEnable) {
    const patterns = getDllModePatterns();
    if (patterns) {
      const content = `DLL名称匹配模式：\n${patterns}`;
      const logFilePath = `${removeSlash(projectAssemblyOutPath.value)}/SMOM发布日志_${formatDate(new Date(), "YYYYmmddHHMMSS")}.log`;
      const saveResult = await cmdInvoke("save_content_to_file", {
        content,
        filePath: logFilePath
      });
      if (saveResult.code === 0) {
        generatePublishLog.value.logs = `日志信息已保存到: ${logFilePath}`;
      }
    }
  }

  // 打开输出目录
  if (isOpenDir) await cmdInvoke("open_dir", { path: projectOutPath });
  return isSuccess;
};

// 获取Dll日期范围
const getDllModeDateRange = () => {
  let startDate = "";
  let endDate = "";
  if (state.publishData.appconfigData.dllMode == "当天") {
    startDate = formatDate(new Date(), "YYYY-mm-dd 00:00:00");
    endDate = formatDate(new Date(), "YYYY-mm-dd 23:59:59");
  }
  if (state.publishData.appconfigData.dllMode == "最近3天") {
    const threeDaysAgo = new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000);
    startDate = formatDate(threeDaysAgo, "YYYY-mm-dd 00:00:00");
    endDate = formatDate(new Date(), "YYYY-mm-dd 23:59:59");
  }
  if (state.publishData.appconfigData.dllMode == "日期范围") {
    const modeDates = JSON.parse(String(state.publishData.appconfigData.dllModeValue));
    startDate = modeDates[0];
    endDate = modeDates[1];
  }
  if (!startDate || !endDate) return [];
  return [startDate, endDate];
};

// 获取DLL名称模式
const getDllModePatterns = () => {
  if (state.publishData.appconfigData.dllMode == "DLL名称") {
    return String(state.publishData.appconfigData.dllModeValue || "");
  }
  return "";
};

// [新]复制Wpf应用程序集[文件]
const newCopyWpfAssemblyFile = async (
  projectOutPath: string,
  appConfig: WpfClientConfigType
) => {
  printInfoLog(`正在获取 ${wpfClientName.value} 程序集.`);

  // 删除项目输出目录
  let outPath = `${projectOutPath}/${wpfClientName.value}`;
  const projectOutPathExists = await cmdInvoke("exists", {
    path: outPath,
  });
  if (projectOutPathExists.code === 0) {
    await cmdInvoke("delete_paths", {
      paths: [outPath],
    });
  }
  let createPathResult = await createDir(outPath);
  if (!createPathResult) {
    printInfoLog(`创建目录失败：${outPath}`, "log-error");
    return false;
  }
  if (!appConfig.clientPath) {
    printInfoLog(`${wpfClientName.value} 的[客户端生成路径]未配置，请检查.`, "log-error");
    return false;
  }
  if (!appConfig.generateDirJson) {
    printInfoLog(`${wpfClientName.value} 未选择[生成的目录]，请检查.`, "log-error");
    return false;
  }

  try {
    let dllModeDateRange = getDllModeDateRange();
    // 1.[生成目录]
    let generateDirArr = JSON.parse(appConfig.generateDirJson);
    for (let i = 0; i < generateDirArr.length; i++) {
      const generateDir = generateDirArr[i];
      // 验证目录是否存在
      const dirPath = `${removeSlash(appConfig.clientPath)}/${generateDir}`;
      if (generateDir == "Plugins" || generateDir == "Lib") {
        await cmdInvoke("delete_paths", {
          paths: [dirPath],
        });
        await createDir(dirPath);
        let cmdName = generateDir == "Plugins" ? "copy_sie_dlls" : "copy_non_sie_dlls";
        let copyDllFileResult = await cmdInvoke(cmdName, {
          srcDir: removeSlash(appConfig.clientPath),
          destDir: dirPath,
        });
        if (copyDllFileResult.code !== 0) {
          printInfoLog(
            `${generateDir}目录不存在，请检查路径或编译项目试试.`,
            "log-error"
          );
          return false;
        }
      }
      const dirPathExists = await cmdInvoke("exists", { path: dirPath });
      if (dirPathExists.code !== 0) {
        printInfoLog(`${generateDir}目录不存在，请检查路径或编译项目试试.`, "log-error");
        return false;
      }

      // 复制目录
      let copyResult = {
        code: 0,
        msg: "success",
        data: null,
      };
      const toGenerateDir = `${removeSlash(outPath)}/${generateDir}`;
      await createDir(toGenerateDir);

      if (state.publishData.appconfigData.dllMode == "TFS") {
        if (!state.publishData.appconfigData.dllModeValue) {
          printInfoLog(`未配置TFS获取程序集的相关信息，请检查.`, "log-error");
          return false;
        }
        const selectTfsItem = JSON.parse(
          state.publishData.appconfigData.dllModeValue
        ) as SelectTfsType;
        const tfsDllFiles = await getTfsDllFiles(selectTfsItem);
        if (!tfsDllFiles || tfsDllFiles.length < 1) return false;

        for (let j = 0; j < tfsDllFiles.length; j++) {
          const tfsDllFile = tfsDllFiles[j];
          const clientPath = removeSlash(dirPath);
          copyResult = await cmdInvoke("copy_path", {
            source: `${clientPath}/${tfsDllFile}`,
            destination: `${toGenerateDir}/${tfsDllFile}`,
          });
          if (copyResult.code !== 0) break;
        }
      } else if (state.publishData.appconfigData.dllMode == "DLL名称") {
        const patterns = getDllModePatterns();
        if (!patterns) {
          printInfoLog(`未配置DLL名称获取程序集的相关信息，请检查.`, "log-error");
          return false;
        }
        copyResult = await cmdInvoke("copy_dll_files_by_name", {
          source: dirPath,
          destination: `${outPath}/${generateDir}`,
          patterns: patterns,
        });
      } else {
        if (dllModeDateRange.length < 1) {
          copyResult = await cmdInvoke("copy_path", {
            source: dirPath,
            destination: `${outPath}/${generateDir}`,
          });
        } else {
          copyResult = await cmdInvoke("copy_path_by_time", {
            source: dirPath,
            destination: `${outPath}/${generateDir}`,
            startTime: dllModeDateRange[0],
            endTime: dllModeDateRange[1],
          });
        }
      }

      if (copyResult.code !== 0) {
        printInfoLog(`复制[${generateDir}]失败：${copyResult.data}`, "log-error");
        return false;
      }

      // 验证文件是否存在
      const isDirEmpty = await cmdInvoke("is_dir_empty", {
        path: `${outPath}/${generateDir}`,
      });
      if (isDirEmpty.code !== 0) {
        printInfoLog(`输出路径为空：${`${outPath}/${generateDir}`}.`, "log-warning");
      }
    }

    // 2.[打包(压缩)文件]
    if (appConfig.isCompress == 1) {
      if (!appConfig.compressFileJson) {
        printInfoLog(
          `${wpfClientName.value} 未选择要打包(压缩)文件，请检查.`,
          "log-error"
        );
        return false;
      }

      let compressFileArr = JSON.parse(appConfig.compressFileJson);
      if (compressFileArr.includes("Plugins.zip")) {
        const pluginsPath = `${removeSlash(appConfig.clientPath)}/Plugins`;
        const pluginsZipResult = await cmdInvoke("zip_dir", {
          srcDir: pluginsPath,
          dstFile: `${outPath}/Plugins.zip`,
        });
        if (pluginsZipResult.code !== 0) {
          printInfoLog(`压缩[Plugins.zip]失败：${pluginsZipResult.data}.`, "log-error");
          return false;
        }
      }

      if (compressFileArr.includes("Lib.zip")) {
        const libPath = `${removeSlash(appConfig.clientPath)}/Lib`;
        const libZipResult = await cmdInvoke("zip_dir", {
          srcDir: libPath,
          dstFile: `${outPath}/Lib.zip`,
        });
        if (libZipResult.code !== 0) {
          printInfoLog(`压缩[Lib.zip]失败：${libZipResult.data}.`, "log-error");
          return false;
        }
      }

      if (compressFileArr.includes("runtimes.zip")) {
        const tempRuntimesPath = `${removeSlash(
          appConfig.clientPath
        )}/tmp_runtimes/runtimes`;
        await cmdInvoke("delete_paths", {
          paths: [tempRuntimesPath],
        });
        await createDir(tempRuntimesPath);

        const addRuntimesPath = `${removeSlash(appConfig.clientPath)}/runtimes`;
        await cmdInvoke("copy_path", {
          source: addRuntimesPath,
          destination: tempRuntimesPath,
        });

        const zipRuntimesResult = await cmdInvoke("zip_dir", {
          srcDir: `${removeSlash(appConfig.clientPath)}/tmp_runtimes`,
          dstFile: `${outPath}/runtimes.zip`,
        });
        if (zipRuntimesResult.code !== 0) {
          printInfoLog(`压缩[runtimes.zip]失败：${zipRuntimesResult.data}.`, "log-error");
          return false;
        }

        await cmdInvoke("delete_paths", {
          paths: [tempRuntimesPath],
        });
      }

      if (compressFileArr.includes("AddIns.zip")) {
        const addInsPath = `${removeSlash(appConfig.clientPath)}/AddIns`;
        const compresseAddInsResult = await cmdInvoke("compress_zip", {
          filePaths: [addInsPath],
          dstFile: `${outPath}/AddIns.zip`,
        });
        if (compresseAddInsResult.code !== 0) {
          printInfoLog(
            `压缩[AddIns.zip]失败：${compresseAddInsResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("Localization.zip")) {
        const localizationPath = `${removeSlash(appConfig.clientPath)}/Localization`;
        const compresseAddInsResult = await cmdInvoke("compress_zip", {
          filePaths: [localizationPath],
          dstFile: `${outPath}/Localization.zip`,
        });
        if (compresseAddInsResult.code !== 0) {
          printInfoLog(
            `压缩[Localization.zip]失败：${compresseAddInsResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("Templates.zip")) {
        const templatesPath = `${removeSlash(appConfig.clientPath)}/Templates`;
        const compresseAddInsResult = await cmdInvoke("compress_zip", {
          filePaths: [templatesPath],
          dstFile: `${outPath}/Templates.zip`,
        });
        if (compresseAddInsResult.code !== 0) {
          printInfoLog(
            `压缩[Templates.zip]失败：${compresseAddInsResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("Config.zip")) {
        // 将log4net.config、SIE.MOM.deps.json、SIE.MOM.runtimeconfig.json、RazorTemplate.txt、appsettings.json打包 -->  Config.zip
        const log4netConfigFile = `${removeSlash(appConfig.clientPath)}/log4net.config`;
        const log4netConfigFileExists = await cmdInvoke("exists", {
          path: log4netConfigFile,
        });
        if (log4netConfigFileExists.code !== 0) {
          printInfoLog(
            "未找到log4net.config文件，请检查路径或编译项目试试.",
            "log-error"
          );
          return false;
        }

        const sieMomDepsFile = `${removeSlash(appConfig.clientPath)}/SIE.MOM.deps.json`;
        const sieMomDepsFileExists = await cmdInvoke("exists", {
          path: sieMomDepsFile,
        });
        if (sieMomDepsFileExists.code !== 0) {
          printInfoLog(
            "未找到SIE.MOM.deps.json文件，请检查路径或编译项目试试.",
            "log-error"
          );
          return false;
        }

        const sieMomRuntimeconfigFile = `${removeSlash(
          appConfig.clientPath
        )}/SIE.MOM.runtimeconfig.json`;
        const sieMomRuntimeconfigFileExists = await cmdInvoke("exists", {
          path: sieMomRuntimeconfigFile,
        });
        if (sieMomRuntimeconfigFileExists.code !== 0) {
          printInfoLog(
            "未找到SIE.MOM.runtimeconfig.json文件，请检查路径或编译项目试试.",
            "log-error"
          );
          return false;
        }

        const sieMomRazorTemplateFile = `${removeSlash(
          appConfig.clientPath
        )}/RazorTemplate.txt`;
        const sieMomRazorTemplateFileExists = await cmdInvoke("exists", {
          path: sieMomRazorTemplateFile,
        });
        if (sieMomRazorTemplateFileExists.code !== 0) {
          printInfoLog(
            "未找到RazorTemplate.txt文件，请检查路径或编译项目试试.",
            "log-error"
          );
          return false;
        }

        const appsettingsFile = `${removeSlash(appConfig.clientPath)}/appsettings.json`;
        const appsettingsFileExists = await cmdInvoke("exists", {
          path: appsettingsFile,
        });
        if (appsettingsFileExists.code !== 0) {
          printInfoLog(
            "未找到appsettings.json文件，请检查路径或编译项目试试.",
            "log-error"
          );
          return false;
        }

        const compresseConfigResult = await cmdInvoke("compress_zip", {
          filePaths: [
            log4netConfigFile,
            sieMomDepsFile,
            sieMomRuntimeconfigFile,
            sieMomRazorTemplateFile,
            appsettingsFile,
          ],
          dstFile: `${outPath}/Config.zip`,
        });
        if (compresseConfigResult.code !== 0) {
          printInfoLog(
            `压缩[Config.zip]失败：${compresseConfigResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("Main.zip")) {
        // 将SIE.dll、SIE.MOM.exe、SIE.Wpf.dll打包 -->  Main.zip
        const sieDllFile = `${removeSlash(appConfig.clientPath)}/SIE.dll`;
        const sieDllFileExists = await cmdInvoke("exists", { path: sieDllFile });
        if (sieDllFileExists.code !== 0) {
          printInfoLog("未找到SIE.dll文件，请检查路径或编译项目试试.", "log-error");
          return false;
        }

        const sieMomExeFile = `${removeSlash(appConfig.clientPath)}/SIE.MOM.exe`;
        const sieMomExeFileExists = await cmdInvoke("exists", { path: sieMomExeFile });
        if (sieMomExeFileExists.code !== 0) {
          printInfoLog("未找到SIE.MOM.exe文件，请检查路径或编译项目试试.", "log-error");
          return false;
        }

        const sieWpfDllFile = `${removeSlash(appConfig.clientPath)}/SIE.Wpf.dll`;
        const sieWpfDllFileExists = await cmdInvoke("exists", { path: sieWpfDllFile });
        if (sieWpfDllFileExists.code !== 0) {
          printInfoLog("未找到SIE.Wpf.dll文件，请检查路径或编译项目试试.", "log-error");
          return false;
        }

        const compresseMainResult = await cmdInvoke("compress_zip", {
          filePaths: [sieDllFile, sieMomExeFile, sieWpfDllFile],
          dstFile: `${outPath}/Main.zip`,
        });
        if (compresseMainResult.code !== 0) {
          printInfoLog(`压缩[Main.zip]失败：${compresseMainResult.data}.`, "log-error");
          return false;
        }
      }
    }
  } catch (error) {
    printInfoLog(
      `获取程序集 ${wpfClientName.value} 出错：${JSON.stringify(error)}`,
      "log-error"
    );
    return false;
  }
  printInfoLog(`获取程序集 ${wpfClientName.value} 成功.`, "log-success");
  return true;
};

// 复制Wpf应用程序集[文件]
const copyWpfAssemblyFile = async (
  projectOutPath: string,
  appConfig: WpfClientConfigType
) => {
  printInfoLog(`正在获取 ${wpfClientName.value} 程序集.`);

  // 删除项目输出目录
  let outPath = `${projectOutPath}/${wpfClientName.value}`;
  const projectOutPathExists = await cmdInvoke("exists", {
    path: outPath,
  });
  if (projectOutPathExists.code === 0) {
    await cmdInvoke("delete_paths", {
      paths: [outPath],
    });
  }
  let createPathResult = await createDir(outPath);
  if (!createPathResult) {
    printInfoLog(`创建目录失败：${outPath}`, "log-error");
    return false;
  }
  if (!appConfig.clientPath) {
    printInfoLog(`${wpfClientName.value} 的[客户端生成路径]未配置，请检查.`, "log-error");
    return false;
  }
  if (!appConfig.generateDirJson) {
    printInfoLog(`${wpfClientName.value} 未选择[生成的目录]，请检查.`, "log-error");
    return false;
  }

  try {
    let dllModeDateRange = getDllModeDateRange();
    // 1.[生成目录]
    let generateDirArr = JSON.parse(appConfig.generateDirJson);
    for (let i = 0; i < generateDirArr.length; i++) {
      const generateDir = generateDirArr[i];
      // 验证目录是否存在
      const dirPath = `${removeSlash(appConfig.clientPath)}/${generateDir}`;
      const dirPathExists = await cmdInvoke("exists", { path: dirPath });
      if (dirPathExists.code !== 0) {
        printInfoLog(`${generateDir}目录不存在，请检查路径或编译项目试试.`, "log-error");
        return false;
      }

      // 复制目录
      let copyResult = {
        code: 0,
        msg: "success",
        data: null,
      };
      const toGenerateDir = `${removeSlash(outPath)}/${generateDir}`;
      await createDir(toGenerateDir);

      if (state.publishData.appconfigData.dllMode == "TFS") {
        if (!state.publishData.appconfigData.dllModeValue) {
          printInfoLog(`未配置TFS获取程序集的相关信息，请检查.`, "log-error");
          return false;
        }
        const selectTfsItem = JSON.parse(
          state.publishData.appconfigData.dllModeValue
        ) as SelectTfsType;
        const tfsDllFiles = await getTfsDllFiles(selectTfsItem);
        if (!tfsDllFiles || tfsDllFiles.length < 1) return false;

        for (let j = 0; j < tfsDllFiles.length; j++) {
          const tfsDllFile = tfsDllFiles[j];
          const clientPath = removeSlash(dirPath);
          copyResult = await cmdInvoke("copy_path", {
            source: `${clientPath}/${tfsDllFile}`,
            destination: `${toGenerateDir}/${tfsDllFile}`,
          });
          if (copyResult.code !== 0) break;
        }
      } else if (state.publishData.appconfigData.dllMode == "DLL名称") {
        const patterns = getDllModePatterns();
        if (!patterns) {
          printInfoLog(`未配置DLL名称获取程序集的相关信息，请检查.`, "log-error");
          return false;
        }
        copyResult = await cmdInvoke("copy_dll_files_by_name", {
          source: dirPath,
          destination: `${outPath}/${generateDir}`,
          patterns: patterns,
        });
      } else {
        if (dllModeDateRange.length < 1) {
          copyResult = await cmdInvoke("copy_path", {
            source: dirPath,
            destination: `${outPath}/${generateDir}`,
          });
        } else {
          copyResult = await cmdInvoke("copy_path_by_time", {
            source: dirPath,
            destination: `${outPath}/${generateDir}`,
            startTime: dllModeDateRange[0],
            endTime: dllModeDateRange[1],
          });
        }
      }

      if (copyResult.code !== 0) {
        printInfoLog(`复制[${generateDir}]失败：${copyResult.data}`, "log-error");
        return false;
      }

      // 验证文件是否存在
      const isDirEmpty = await cmdInvoke("is_dir_empty", {
        path: `${outPath}/${generateDir}`,
      });
      if (isDirEmpty.code !== 0) {
        printInfoLog(`输出路径为空：${`${outPath}/${generateDir}`}.`, "log-warning");
      }
    }

    // 2.[打包(压缩)文件]
    if (appConfig.isCompress == 1) {
      if (!appConfig.compressFileJson) {
        printInfoLog(
          `${wpfClientName.value} 未选择要打包(压缩)文件，请检查.`,
          "log-error"
        );
        return false;
      }
      let compressFileArr = JSON.parse(appConfig.compressFileJson);
      if (compressFileArr.includes("Plugins.zip")) {
        const domainPath = `${removeSlash(appConfig.clientPath)}/Domain`;
        const uiPath = `${removeSlash(appConfig.clientPath)}/UI`;
        const compressePluginsResult = await cmdInvoke("compress_zip", {
          filePaths: [domainPath, uiPath],
          dstFile: `${outPath}/Plugins.zip`,
        });
        if (compressePluginsResult.code !== 0) {
          printInfoLog(
            `压缩[Plugins.zip]失败：${compressePluginsResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("AddIns.zip")) {
        const addInsPath = `${removeSlash(appConfig.clientPath)}/AddIns`;
        const compresseAddInsResult = await cmdInvoke("compress_zip", {
          filePaths: [addInsPath],
          dstFile: `${outPath}/AddIns.zip`,
        });
        if (compresseAddInsResult.code !== 0) {
          printInfoLog(
            `压缩[AddIns.zip]失败：${compresseAddInsResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("Lib.zip")) {
        const libPath = `${removeSlash(appConfig.clientPath)}/Lib`;
        const compresseAddInsResult = await cmdInvoke("compress_zip", {
          filePaths: [libPath],
          dstFile: `${outPath}/Lib.zip`,
        });
        if (compresseAddInsResult.code !== 0) {
          printInfoLog(`压缩[Lib.zip]失败：${compresseAddInsResult.data}.`, "log-error");
          return false;
        }
      }

      if (compressFileArr.includes("Localization.zip")) {
        const localizationPath = `${removeSlash(appConfig.clientPath)}/Localization`;
        const compresseAddInsResult = await cmdInvoke("compress_zip", {
          filePaths: [localizationPath],
          dstFile: `${outPath}/Localization.zip`,
        });
        if (compresseAddInsResult.code !== 0) {
          printInfoLog(
            `压缩[Localization.zip]失败：${compresseAddInsResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("Templates.zip")) {
        const templatesPath = `${removeSlash(appConfig.clientPath)}/Templates`;
        const compresseAddInsResult = await cmdInvoke("compress_zip", {
          filePaths: [templatesPath],
          dstFile: `${outPath}/Templates.zip`,
        });
        if (compresseAddInsResult.code !== 0) {
          printInfoLog(
            `压缩[Templates.zip]失败：${compresseAddInsResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("Config.zip")) {
        // 将log4net.config、SIE.MOM.exe.config、appsettings.json打包 -->  Config.zip
        const log4netConfigFile = `${removeSlash(appConfig.clientPath)}/log4net.config`;
        const log4netConfigFileExists = await cmdInvoke("exists", {
          path: log4netConfigFile,
        });
        if (log4netConfigFileExists.code !== 0) {
          printInfoLog(
            "未找到log4net.config文件，请检查路径或编译项目试试.",
            "log-error"
          );
          return false;
        }

        const sieMomExeConfigFile = `${removeSlash(
          appConfig.clientPath
        )}/SIE.MOM.exe.config`;
        const sieMomExeConfigFileExists = await cmdInvoke("exists", {
          path: sieMomExeConfigFile,
        });
        if (sieMomExeConfigFileExists.code !== 0) {
          printInfoLog(
            "未找到SIE.MOM.exe.config文件，请检查路径或编译项目试试.",
            "log-error"
          );
          return false;
        }

        const appsettingsFile = `${removeSlash(appConfig.clientPath)}/appsettings.json`;
        const appsettingsFileExists = await cmdInvoke("exists", {
          path: appsettingsFile,
        });
        if (appsettingsFileExists.code !== 0) {
          printInfoLog(
            "未找到appsettings.json文件，请检查路径或编译项目试试.",
            "log-error"
          );
          return false;
        }

        const compresseConfigResult = await cmdInvoke("compress_zip", {
          filePaths: [log4netConfigFile, sieMomExeConfigFile, appsettingsFile],
          dstFile: `${outPath}/Config.zip`,
        });
        if (compresseConfigResult.code !== 0) {
          printInfoLog(
            `压缩[Config.zip]失败：${compresseConfigResult.data}.`,
            "log-error"
          );
          return false;
        }
      }

      if (compressFileArr.includes("Main.zip")) {
        // 将SIE.dll、SIE.MOM.exe、SIE.Wpf.dll打包 -->  Main.zip
        const sieDllFile = `${removeSlash(appConfig.clientPath)}/SIE.dll`;
        const sieDllFileExists = await cmdInvoke("exists", { path: sieDllFile });
        if (sieDllFileExists.code !== 0) {
          printInfoLog("未找到SIE.dll文件，请检查路径或编译项目试试.", "log-error");
          return false;
        }

        const sieMomExeFile = `${removeSlash(appConfig.clientPath)}/SIE.MOM.exe`;
        const sieMomExeFileExists = await cmdInvoke("exists", { path: sieMomExeFile });
        if (sieMomExeFileExists.code !== 0) {
          printInfoLog("未找到SIE.MOM.exe文件，请检查路径或编译项目试试.", "log-error");
          return false;
        }

        const sieWpfDllFile = `${removeSlash(appConfig.clientPath)}/SIE.Wpf.dll`;
        const sieWpfDllFileExists = await cmdInvoke("exists", { path: sieWpfDllFile });
        if (sieWpfDllFileExists.code !== 0) {
          printInfoLog("未找到SIE.Wpf.dll文件，请检查路径或编译项目试试.", "log-error");
          return false;
        }

        const compresseMainResult = await cmdInvoke("compress_zip", {
          filePaths: [sieDllFile, sieMomExeFile, sieWpfDllFile],
          dstFile: `${outPath}/Main.zip`,
        });
        if (compresseMainResult.code !== 0) {
          printInfoLog(`压缩[Main.zip]失败：${compresseMainResult.data}.`, "log-error");
          return false;
        }
      }
    }
  } catch (error) {
    printInfoLog(
      `获取程序集 ${wpfClientName.value} 出错：${JSON.stringify(error)}`,
      "log-error"
    );
    return false;
  }
  printInfoLog(`获取程序集 ${wpfClientName.value} 成功.`, "log-success");
  return true;
};

// 复制应用程序集[文件]
const copyAssemblyFile = async (
  appTypeName: "WebApiHost" | "ScheduleServer" | "WebClient" | "SpcMonitor",
  projectOutPath: string,
  appConfig:
    | WebApiHostConfigType
    | ScheduleServerConfigType
    | WebClientConfigType
    | SpcMonitorConfigType
) => {
  printInfoLog(`正在获取 ${appTypeName} 程序集.`);

  // 删除项目输出目录
  let outPath = `${projectOutPath}/${appTypeName}`;
  const projectOutPathExists = await cmdInvoke("exists", {
    path: outPath,
  });
  if (projectOutPathExists.code === 0) {
    await cmdInvoke("delete_paths", {
      paths: [outPath],
    });
  }
  let createPathResult = await createDir(outPath);
  if (!createPathResult) {
    printInfoLog(`创建目录失败：${outPath}`, "log-error");
    return false;
  }
  if (!appConfig.clientPath) {
    printInfoLog(`${appTypeName} 的[客户端生成路径]未配置，请检查.`, "log-error");
    return false;
  }
  try {
    let copyResult = {
      code: 0,
      msg: "success",
      data: null,
    };
    if (state.publishData.appconfigData.dllMode == "TFS") {
      if (!state.publishData.appconfigData.dllModeValue) {
        printInfoLog(`未配置TFS获取程序集的相关信息，请检查.`, "log-error");
        return false;
      }
      const selectTfsItem = JSON.parse(
        state.publishData.appconfigData.dllModeValue
      ) as SelectTfsType;
      const tfsDllFiles = await getTfsDllFiles(selectTfsItem);
      if (!tfsDllFiles || tfsDllFiles.length < 1) return false;
      for (let o = 0; o < tfsDllFiles.length; o++) {
        const tfsDllFile = tfsDllFiles[o];
        const clientPath = removeSlash(appConfig.clientPath);
        copyResult = await cmdInvoke("copy_path", {
          source: `${clientPath}/${tfsDllFile}`,
          destination: `${removeSlash(outPath)}/${tfsDllFile}`,
        });
        if (copyResult.code !== 0) break;
      }
    } else if (state.publishData.appconfigData.dllMode == "Git") {
      if (!state.publishData.appconfigData.dllModeValue) {
        printInfoLog(`未配置Git获取程序集的相关信息，请检查.`, "log-error");
        return false;
      }
      const selectGitItem = JSON.parse(
        state.publishData.appconfigData.dllModeValue
      ) as SelectGitType;
      const gitDllFiles = await getGitDllFiles(selectGitItem);
      console.log('gitDllFiles', gitDllFiles);
      if (!gitDllFiles || gitDllFiles.length < 1) return false;
      for (let o = 0; o < gitDllFiles.length; o++) {
        const gitDllFile = gitDllFiles[o];
        const clientPath = removeSlash(appConfig.clientPath);
        copyResult = await cmdInvoke("copy_path", {
          source: `${clientPath}/${gitDllFile}`,
          destination: `${removeSlash(outPath)}/${gitDllFile}`,
        });
        if (copyResult.code !== 0) break;
      }
    }
    else if (state.publishData.appconfigData.dllMode == "DLL名称") {
      const patterns = getDllModePatterns();
      if (!patterns) {
        printInfoLog(`未配置DLL名称获取程序集的相关信息，请检查.`, "log-error");
        return false;
      }
      copyResult = await cmdInvoke("copy_dll_files_by_name", {
        source: appConfig.clientPath,
        destination: outPath,
        patterns: patterns,
      });
    }
    else {
      let dllModeDateRange = getDllModeDateRange();
      if (dllModeDateRange.length < 1) {
        copyResult = await cmdInvoke("copy_dll_files", {
          source: appConfig.clientPath,
          destination: outPath,
          delDestination: true,
        });
      } else {
        copyResult = await cmdInvoke("copy_dll_files_by_time", {
          source: appConfig.clientPath,
          destination: outPath,
          delDestination: true,
          startTime: dllModeDateRange[0],
          endTime: dllModeDateRange[1],
        });
      }
    }
    if (copyResult.code !== 0) {
      printInfoLog(`获取程序集 ${appTypeName} 失败：${copyResult.data}`, "log-error");
      return false;
    }
  } catch (error) {
    printInfoLog(`获取程序集 ${appTypeName} 出错：${JSON.stringify(error)}`, "log-error");
    return false;
  }
  // 验证是否为空文件夹
  const dirEmptyResult = await cmdInvoke("is_dir_empty", {
    path: outPath,
  });
  if (dirEmptyResult.code !== 0) {
    printInfoLog(`输出路径为空：${outPath}.`, "log-warning");
  } else {
    printInfoLog(`获取程序集 ${appTypeName} 成功.`, "log-success");
  }
  return true;
};

// 构造TFS命令
const getTfsDllFiles = async (selectTfsItem: SelectTfsType) => {
  const tfsItem = await getTfsDetail(Number(selectTfsItem.id));
  if (!tfsItem) return null;
  if (!generatePublishLog.value.data) {
    // 构造命令行
    let execArgs = new Array<string>();
    execArgs.push("history");
    execArgs.push(`/collection:${tfsItem.tfsServerUrl}`);
    execArgs.push(`${tfsItem.tfsSourcePath}`);
    execArgs.push("/noprompt");
    if (selectTfsItem.selectModel === "日期") {
      const bDate = new Date(selectTfsItem.selectValue[0].value);
      const beginDate = formatDate(bDate, "DYYYY-mm-ddTHH:MM:SS");
      let endDate = "";
      if (selectTfsItem.selectValue[1].value) {
        const eDate = new Date(selectTfsItem.selectValue[1].value);
        endDate = formatDate(eDate, "DYYYY-mm-ddTHH:MM:SS");
      }
      execArgs.push(`-V:${beginDate}~${endDate}`);
    }
    if (selectTfsItem.selectModel === "变更集") {
      const beginChangeSets = `C${selectTfsItem.selectValue[0].value}`;
      let endChangeSets = "";
      if (selectTfsItem.selectValue[1].value) {
        endChangeSets = `C${selectTfsItem.selectValue[1].value}`;
      }
      execArgs.push(`-V:${beginChangeSets}~${endChangeSets}`);
    }
    execArgs.push("-R");
    execArgs.push("-F:detailed");
    console.log('execArgs',execArgs);
    const execResult = await cmdInvoke("execute_local_command", {
      command: tfsItem.tfvcPath,
      args: execArgs,
    });
    if (execResult.code !== 0) {
      printInfoLog(`TFS命令执行失败：${execResult.data}`, "log-error");
      return null;
    }
    generatePublishLog.value.data = execResult.data;
  }

  // 生成发布日志
  if (generatePublishLog.value.isEnable) {
    let generateResult: DataResultType = {
      code: 1,
      msg: "success",
      data: null,
    };
    const dllResolveOptions = await getPublishLogResolveOptions();
    switch (generatePublishLog.value.type) {
      case "仅发布内容":
        generateResult = await outPublishContents(
          generatePublishLog.value.data,
          projectAssemblyOutPath.value
        );
        break;
      case "按日期":
        generateResult = await outPublishContentByDates(
          generatePublishLog.value.data,
          generatePublishLog.value.displayPublishField,
          projectAssemblyOutPath.value,
          true,
          dllResolveOptions
        );
        break;
      case "按用户":
        generateResult = await outPublishContentByUsers(
          generatePublishLog.value.data,
          generatePublishLog.value.displayPublishField,
          projectAssemblyOutPath.value,
          true,
          dllResolveOptions
        );
        break;
      default:
        generateResult = await outDetaultPublishContents(
          generatePublishLog.value.data,
          generatePublishLog.value.displayPublishField,
          projectAssemblyOutPath.value,
          true,
          dllResolveOptions
        );
        break;
    }
    if (generateResult.code === 0) {
      generatePublishLog.value.logs = generateResult.msg;
    }
  }
  console.log('generatePublishLog.value.data', generatePublishLog.value.data);
  // 筛选变更项
  const lines = generatePublishLog.value.data.split("\n");
  const tfsItems = lines
    .map((line: string) => getTfsChangedPath(line, tfsItem.tfsSourcePath))
    .filter((item: string) => item);
  return await getDllFilesByChangedItems(tfsItems, {
    repositoryPath: tfsItem.tfsLocalPath,
    sourcePath: tfsItem.tfsSourcePath,
  });
};

// 构造Git命令
const getGitDllFiles = async (selectGitItem: SelectGitType) => {
  const gitItem = await getGitDetail(Number(selectGitItem.id));
  // console.log('gitItem', gitItem)
  if (!gitItem) return null;
  if (!generatePublishLog.value.data) {
    // Git命令执行
    let execArgs = new Array<string | null>();
    execArgs.push("log");
    execArgs.push("--pretty=format:%H|%an|%ae|%ad|%s"); // 格式化输出
    execArgs.push("--name-status"); // 包含文件变更状态
    if (selectGitItem.selectModel === "日期") {
      const bDate = new Date(selectGitItem.selectValue[0].value);
      const beginDate = formatDate(bDate, "DYYYY-mm-ddTHH:MM:SS");
      let endDate = "";
      if (selectGitItem.selectValue[1].value) {
        const eDate = new Date(selectGitItem.selectValue[1].value);
        endDate = formatDate(eDate, "DYYYY-mm-ddTHH:MM:SS");
      }
      execArgs.push(`--since=${beginDate}`);
      execArgs.push(`--until=${endDate}`);
    }
    if (selectGitItem.selectModel === "commit") {

      const startSha = selectGitItem.selectValue[0].value;
      const endSha = selectGitItem.selectValue[1].value;

      // 如果只填写了起始SHA，则查询从该SHA到HEAD的所有提交（包含起始SHA）
      if (startSha && !endSha) {
        execArgs.push(`${startSha}..HEAD`);
      }
      // 如果填写了起始和结束SHA，则查询范围（包含起始SHA和结束SHA）
      else if (startSha && endSha) {
        execArgs.push(`${startSha}^..${endSha}`);
      }
      // 如果只填写了结束SHA（理论上不应该发生）
      else if (!startSha && endSha) {
        execArgs.push(endSha);
      }
    }
    // console.log('execArgs', execArgs)
    execArgs.push(gitItem.branchName);
    const execResult = await cmdInvoke("execute_local_command_with_working_dir", {
      command: gitItem.gitPath,
      args: execArgs,
      workingDir: gitItem.gitRepository
    });
    console.log('execResult', execResult)
    if (execResult.code !== 0) {
      printInfoLog(`Git命令执行失败：${execResult.data}`, "log-error");
      return null;
    }
    generatePublishLog.value.data = execResult.data;
  }

  // 生成发布日志
  if (generatePublishLog.value.isEnable) {
    let generateResult: DataResultType = {
      code: 1,
      msg: "success",
      data: null,
    };
    const dllResolveOptions = await getPublishLogResolveOptions();
    switch (generatePublishLog.value.type) {
      case "仅发布内容":
        generateResult = await outPublishContents(
          generatePublishLog.value.data,
          projectAssemblyOutPath.value
        );
        break;
      case "按日期":
        generateResult = await outPublishContentByDates(
          generatePublishLog.value.data,
          generatePublishLog.value.displayPublishField,
          projectAssemblyOutPath.value,
          true,
          dllResolveOptions
        );
        break;
      case "按用户":
        generateResult = await outPublishContentByUsers(
          generatePublishLog.value.data,
          generatePublishLog.value.displayPublishField,
          projectAssemblyOutPath.value,
          true,
          dllResolveOptions
        );
        break;
      default:
        generateResult = await outDetaultPublishContents(
          generatePublishLog.value.data,
          generatePublishLog.value.displayPublishField,
          projectAssemblyOutPath.value,
          true,
          dllResolveOptions
        );
        break;
    }
    if (generateResult.code === 0) {
      generatePublishLog.value.logs = generateResult.msg;
    }
  }
  // 筛选变更项
  const lines = generatePublishLog.value.data.split("\n");

  // 解析 Git 日志，提取文件变更部分
  let gitItems: string[] = [];
  // 根据提供的Git日志格式，解析包含提交信息和文件变更的格式
  let currentLineIndex = 0;
  while (currentLineIndex < lines.length) {
    const line = lines[currentLineIndex];
    // 匹配提交哈希、作者、邮箱、日期和提交信息的格式
    if (/^[a-f0-9]{40}\|/.test(line)) {
      // 这是包含提交信息的一行，跳过
    } else if (line.trim() && !line.startsWith('commit') && !line.startsWith('Author:') && !line.startsWith('Date:')) {
      // 这可能是文件变更行，格式如：M	Modules/Common/Items/SIE.Items/Items/ItemController.cs
      const fileChangeMatch = line.match(/^([MAD])\s+(.+)$/);
      if (fileChangeMatch) {
        gitItems.push(fileChangeMatch[2].trim());
      }
    }
    currentLineIndex++;
  }
  return await getDllFilesByChangedItems(gitItems, {
    repositoryPath: gitItem.gitRepository,
  });
};

const getPublishLogResolveOptions = async (): Promise<DllResolveOptions> => {
  if (!state.publishData.appconfigData.dllModeValue) return {};
  if (state.publishData.appconfigData.dllMode === "TFS") {
    const selectTfsItem = JSON.parse(
      state.publishData.appconfigData.dllModeValue
    ) as SelectTfsType;
    const tfsItem = await getTfsDetail(Number(selectTfsItem.id));
    return {
      repositoryPath: tfsItem?.tfsLocalPath,
      sourcePath: tfsItem?.tfsSourcePath,
    };
  }
  if (state.publishData.appconfigData.dllMode === "Git") {
    const selectGitItem = JSON.parse(
      state.publishData.appconfigData.dllModeValue
    ) as SelectGitType;
    const gitItem = await getGitDetail(Number(selectGitItem.id));
    return { repositoryPath: gitItem?.gitRepository };
  }
  return {};
};

// 查询Tfs信息
const getTfsDetail = async (id: number) => {
  let dataResult = await tfsDb.getTfsById(id);
  if (dataResult.code !== 0) {
    printInfoLog(dataResult.msg, "log-error");
    return null;
  }
  return dataResult.data.data;
};

// 查询Git信息
const getGitDetail = async (id: number) => {
  let dataResult = await gitDb.getGitById(id);
  if (dataResult.code !== 0) {
    printInfoLog(dataResult.msg, "log-error");
    return null;
  }
  return dataResult.data.data;
};

// 创建目录
const createDir = async (path: string) => {
  const pathExists = await cmdInvoke("exists", { path });
  if (pathExists.code !== 0) {
    return await cmdInvoke("create_dir", { path });
  }
  return true;
};

// 查询项目信息
const getProjectList = async () => {
  let dataResult = await projectDb.getProjectList({
    code: null,
    name: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  projectList.value = dataResult.data.data;
};

// 查询服务信息
const getServerDetail = async (id: number) => {
  let dataResult = await serverDb.getServerById(id);
  if (dataResult.code !== 0) {
    printInfoLog(dataResult.msg, "log-error");
    return null;
  }
  return dataResult.data.data;
};

// 编辑发布配置信息
const onOpenAppConfig = async () => {
  if (!state.publishData.appconfigData.id) return;
  const appConfigResult = await useAppconfigDb().getAppconfigById(
    state.publishData.appconfigData.id
  );
  if (appConfigResult.code !== 0) return;
  appconfigDialogRef.value.openDialog("edit", appConfigResult.data.data);
};

// 获取默认项目
// 获取默认项目并恢复环境
const getProjectDefault = async (options?: { keepCurrentEnvironment?: boolean }) => {
  if (isRefreshingProjectDefault.value) return;
  isRefreshingProjectDefault.value = true;
  try {
    await getProjectList();
    await nextTick();
    let dataResult = await projectDb.getProjectDefault();
    if (dataResult.code == 0 && dataResult.data.data?.id) {
      const projectId = dataResult.data.data.id;

      console.log('=== getProjectDefault 开始执行 ===');
      console.log('  - 默认项目ID:', projectId);

      // 更新项目信息
      state.publishData.projectId = projectId;
      state.publishData.projectName = String(dataResult.data.data.name);
      state.publishData.assemblyOutPath = dataResult.data.data.assemblyOutPath
        ? String(dataResult.data.data.assemblyOutPath)
        : "";

      // 查询该项目有哪些环境配置
      const appconfigDb = useAppconfigDb();
      let availableEnvironments: number[] = [];
      for (let env = 1; env <= 4; env++) {
        const result = await appconfigDb.getPublishAppconfigs(projectId, env);
        if (result.code === 0 && result.data.data && result.data.data.id) {
          availableEnvironments.push(env);
        }
      }

      console.log('  - 可用环境配置:', availableEnvironments);

      // 决定使用哪个环境
      let targetEnvironment = 1; // 默认 Dev
      const currentEnvironment = state.publishData.environment;

      if (options?.keepCurrentEnvironment && availableEnvironments.includes(currentEnvironment)) {
        targetEnvironment = currentEnvironment;
        console.log('  >>> 保持当前环境:', currentEnvironment);
      } else {
        // 1. 先尝试恢复 localStorage 中保存的环境
        const savedEnvironment = restoreEnvironmentFromStorage(projectId);
        if (savedEnvironment && availableEnvironments.includes(savedEnvironment)) {
          // 保存的环境存在且有配置
          targetEnvironment = savedEnvironment;
          console.log('  >>> 恢复保存的环境:', savedEnvironment);
        } else if (availableEnvironments.length > 0) {
          // 2. 如果保存的环境不可用，找第一个有配置的环境
          // 优先级：Dev(1) > Uat(2) > Pro(3) > Other(4)
          availableEnvironments.sort((a, b) => a - b);
          targetEnvironment = availableEnvironments[0];
          console.log('  >>> 保存的环境不可用，使用第一个有配置的环境:', targetEnvironment);
        } else {
          console.log('  >>> 该项目没有任何环境配置，使用默认 Dev');
        }
      }

      state.publishData.environment = targetEnvironment;

      console.log('=== getProjectDefault 执行完毕 ===');
      console.log('  - projectId:', state.publishData.projectId);
      console.log('  - environment:', state.publishData.environment);
    }
    await getPublishAppconfigs();
  } finally {
    isRefreshingProjectDefault.value = false;
  }
};

// 应用配置弹框环境变更
const onAppConfigEnvChange = (newEnv: number) => {
  console.log('=== 应用配置弹框环境变更 ===');
  console.log('  - 旧 environment:', state.publishData.environment);
  console.log('  - 新 environment:', newEnv);
  state.publishData.environment = newEnv;
  console.log('  - 已更新 environment:', state.publishData.environment);
};

// 获取发布的应用程序配置
const getPublishAppconfigs = async () => {
  let dataResult = await appconfigDb.getPublishAppconfigs(
    state.publishData.projectId,
    state.publishData.environment
  );
  showEmptyAppConfig.value = true;
  if (dataResult.code == 0 && dataResult.data.data && dataResult.data.data.id) {
    Object.assign(state.publishData.appconfigData, dataResult.data.data);
    showEmptyAppConfig.value = false;
  } else {
    state.publishData.appconfigData = getDefaultSubObject(
      state.publishData.appconfigData
    );
  }
};

// 保存环境选择到本地存储
const saveEnvironmentToStorage = (projectId: number, environment: number) => {
  try {
    const storageKey = `project_environment_${projectId}`;
    localStorage.setItem(storageKey, String(environment));
  } catch (error) {
    console.error('保存环境选择失败:', error);
  }
};

// 从本地存储恢复环境选择
const restoreEnvironmentFromStorage = (projectId: number): number | null => {
  try {
    const storageKey = `project_environment_${projectId}`;
    const savedEnv = localStorage.getItem(storageKey);
    return savedEnv ? Number(savedEnv) : null;
  } catch (error) {
    console.error('恢复环境选择失败:', error);
    return null;
  }
};

// 显示dll获取方式
const showDllMode = () => {
  let modelName = state.publishData.appconfigData.dllMode;
  if (modelName == "日期范围") {
    let dllModeArr = JSON.parse(String(state.publishData.appconfigData.dllModeValue));
    modelName += `：${dllModeArr[0]} ~ ${dllModeArr[1]}`;
  } else if (modelName == "TFS") {
    const selectTfsItem = JSON.parse(
      String(state.publishData.appconfigData.dllModeValue)
    ) as SelectTfsType;
    modelName += `：${selectTfsItem.tfsName}；${selectTfsItem.selectModel}：${selectTfsItem.selectValue[0].value} ~ `;
    if (selectTfsItem.selectValue[1].value) {
      modelName += `${selectTfsItem.selectValue[1].value}`;
    } else {
      modelName += "latest";
    }
  }
  else if (modelName == "Git") {
    const selectGitItem = JSON.parse(
      String(state.publishData.appconfigData.dllModeValue)
    ) as SelectGitType;
    modelName += `：${selectGitItem.gitName}；${selectGitItem.selectModel}：${selectGitItem.selectValue[0].value} ~ `;
    if (selectGitItem.selectValue[1].value) {
      modelName += `${selectGitItem.selectValue[1].value}`;
    } else {
      modelName += "latest";
    }
  }
  else if (modelName == "DLL名称") {
    const lines = String(state.publishData.appconfigData.dllModeValue || "").split(/\n|、/);
    const firstLine = lines[0]?.trim() || "";
    const more = lines.length > 1 ? ` 等${lines.length}个` : "";
    modelName += `：${firstLine}${more}`;
  }
  return modelName;
};

// 显示生成目录
const showGenerateDir = (jsonValue: string) => {
  if (!jsonValue) return null;
  let generateDirArr = JSON.parse(jsonValue);
  return generateDirArr.join("、");
};

// 显示生成目录
const showCompressFile = (jsonValue: string) => {
  if (!jsonValue) return null;
  let compressFileArr = JSON.parse(jsonValue);
  return compressFileArr.join("、");
};

// 项目切换
const onProjectChange = async (val: number) => {
  let projectObj = projectList.value?.find((item) => item.id === val);
  if (projectObj) {
    state.publishData.projectName = String(projectObj.name);
    state.publishData.assemblyOutPath = projectObj.assemblyOutPath
      ? String(projectObj.assemblyOutPath)
      : "";

    // 从数据库查该项目有哪些环境有配置
    let availableEnvironments: number[] = [];
    for (let env = 1; env <= 4; env++) {
      const result = await appconfigDb.getPublishAppconfigs(val, env);
      if (result.code === 0 && result.data.data && result.data.data.id) {
        availableEnvironments.push(env);
      }
    }

    // 恢复环境：优先用缓存（需有对应配置），否则取第一个有配置的环境
    const savedEnvironment = restoreEnvironmentFromStorage(val);
    if (savedEnvironment && availableEnvironments.includes(savedEnvironment)) {
      state.publishData.environment = savedEnvironment;
    } else if (availableEnvironments.length > 0) {
      availableEnvironments.sort((a, b) => a - b);
      state.publishData.environment = availableEnvironments[0];
    } else {
      state.publishData.environment = 1;
    }
  }
  await getPublishAppconfigs();
};

// 环境切换
const onEnvironmentChange = async (val: number) => {
  console.log('=== 环境切换事件触发 ===');
  console.log('  - 新项目ID:', state.publishData.projectId);
  console.log('  - 新环境值:', val);
  
  // 保存环境选择到本地存储
  saveEnvironmentToStorage(state.publishData.projectId, val);
  
  console.log('  - 环境已保存到 localStorage');
  
  await getPublishAppconfigs();
};

// 设置进度值
// const setProgressTextContent = (textVal: string, progressId: string = "progress") => {
//   const progress = document.getElementById(progressId) as HTMLLabelElement;
//   if (progress) progress.textContent = textVal;
// };

// 清空日志
const onRemoveLogs = () => {
  logPrintInfo.value = [];
  generatePublishLog.value.data = "";
  generatePublishLog.value.logs = "";
};

// 初始化日志
const initLogs = () => {
  printInfoLog("项目名称：" + state.publishData.projectName);
  printInfoLog("项目环境：" + displayEnvironment(state.publishData.environment));
  generatePublishLog.value.data = "";
  generatePublishLog.value.logs = "";
};

// ===== 定时发布检测器 =====

/** 启动定时检测（每30秒轮询待执行任务） */
const startScheduledPublishChecker = () => {
  if (scheduledTimerRef.value) return;
  scheduledTimerRef.value = setInterval(checkScheduledPublish, 30000);
  // 启动后立即执行一次检测
  checkScheduledPublish();
};

/** 停止定时检测 */
const stopScheduledPublishChecker = () => {
  if (scheduledTimerRef.value) {
    clearInterval(scheduledTimerRef.value);
    scheduledTimerRef.value = null;
  }
};

/** 检测并执行到时间的定时发布任务 */
const checkScheduledPublish = async () => {
  if (isScheduledRunning.value) return;
  try {
    const dataResult = await publishScheduleDb.getPendingSchedules();
    if (dataResult.code !== 0 || !dataResult.data.length) return;

    const now = new Date().getTime();
    for (const schedule of dataResult.data) {
      const scheduledTime = new Date(schedule.scheduledTime).getTime();
      if (scheduledTime <= now) {
        await executeScheduledPublish(schedule);
      }
    }
  } catch (error) {
    console.error("检测定时发布任务出错:", error);
  }
};

/** 执行定时发布 */
const executeScheduledPublish = async (schedule: RowPublishScheduleType) => {
  if (isScheduledRunning.value) return;
  isScheduledRunning.value = true;
  try {
    // 更新状态为执行中
    await publishScheduleDb.updateScheduleStatus(schedule.id, 'executing');

    // 切换到对应的项目和配置
    state.publishData.projectId = schedule.projectId;
    state.publishData.projectName = schedule.projectName;
    state.publishData.environment = schedule.environment;
    await getPublishAppconfigs();

    // 初始化日志输出
    onRemoveLogs();
    initLogs();
    printInfoLog(`定时发布任务开始执行：${schedule.publishType}`);

    let success = false;
    if (schedule.publishType === '一键发布') {
      success = await oneClickPublishing();
    } else if (schedule.publishType === '手动发布') {
      success = await projectPublish();
      if (success) await getProjectDefault();
    }

    if (success) {
      printInfoLog(`${schedule.publishType}成功（定时任务）.`);
      try {
        sendNotification({ title: "定时发布完成", body: `${schedule.publishType} - ${schedule.projectName} 发布成功！` });
      } catch { /* 通知失败不影响结果 */ }
      await publishScheduleDb.updateScheduleStatus(schedule.id, 'completed', `${schedule.publishType}成功`);
    } else {
      // 捕获执行过程中的日志作为失败原因
      const failLogs = collectFailLogs();
      await publishScheduleDb.updateScheduleStatus(schedule.id, 'failed', failLogs || `${schedule.publishType}失败`);
    }
  } catch (error) {
    const errorMsg = String(error);
    printInfoLog(`定时发布执行异常：${errorMsg}`, "log-error");
    await publishScheduleDb.updateScheduleStatus(schedule.id, 'failed', errorMsg);
  } finally {
    isScheduledRunning.value = false;
  }
};

/** 收集执行失败时的日志内容 */
const collectFailLogs = () => {
  const logs = logPrintInfo.value
    .filter(log => log.type === "log-error" || log.type === "log-warning")
    .map(log => log.content.value)
    .filter(Boolean);
  // 最多取最近 20 行错误/警告日志
  const recentLogs = logs.slice(-20);
  if (recentLogs.length > 0) {
    return `失败日志（共${logs.length}条）:\n${recentLogs.join("\n")}`;
  }
  return "";
};

/**
 * 打印日志信息
 * @param content 日志内容
 * @param type：log-info、log-warning、log-error、log-success
 */
const printInfoLog = (
  content: string,
  type: "log-info" | "log-warning" | "log-error" | "log-success" = "log-info",
  showDate: boolean = true
) => {
  let nowDate = "";
  if (showDate) {
    nowDate = `[${formatDate(new Date(), "YYYY-mm-dd HH:MM:SS")}] `;
  }
  let logContent = content ? `${nowDate}${content}` : "　";
  let logInfo: LogPrintType = {
    type,
    content: {
      value: logContent,
      uploadFile: {
        currNumber: 0,
        totalNumber: 0,
      },
    },
  };
  logPrintInfo.value.push(logInfo);
  nextTick(() => {
    logContentRef.value.scrollTop = logContentRef.value.scrollHeight;
  });
  return logPrintInfo.value.length - 1;
};

// 页面加载完时
onBeforeMount(async () => {
  console.log('=== onBeforeMount 被调用 ===');
  await getProjectDefault();
});

// 挂载后启动定时发布检测器
onMounted(() => {
  startScheduledPublishChecker();
  reloadSettings();
  mittBus.on("settingsChanged", reloadSettings);
});

// 卸载时停止定时检测
onUnmounted(() => {
  stopScheduledPublishChecker();
  mittBus.off("settingsChanged", reloadSettings);
});

onActivated(async () => {
  console.log('=== onActivated 被调用 ===');
  // 每次进入页面都重新查询默认项目并恢复环境
  await getProjectDefault();

  if (state.funModule[currModuleIndex.value].loading == true) {
    console.log("当前模块正在加载中…");
    return;
  }

  // 每次激活时重启检测（确保定时器运行）
  startScheduledPublishChecker();
  reloadSettings();
});
</script>

<style scoped lang="scss">
$homeNavLengh: 8;

.publish-container {
  overflow: hidden;

  .publish-card-box,
  .publish-card-config {
    .publish-card-item {
      width: 100%;
      height: 130px;
      border-radius: 4px;
      transition: all ease 0.3s;
      overflow: hidden;
      background: var(--el-color-white);
      color: var(--el-text-color-primary);
      border: 1px solid var(--next-border-color-light);

      .card-item-title {
        font-size: 20px;
        color: #506c88;
        text-align: center;
        height: 70px;
        line-height: 70px;
      }

      .card-title {
        padding: 12px 10px 10px 10px;
        height: 45px;
        font-size: 15px;
        border-bottom: 1px #dfdfdf dashed;
        align-content: flex-end;

        .item-btn-box {
          width: 100%;
          text-align: right;
        }
      }

      .card-item-content {
        height: calc(100vh - 308px);
        overflow-y: auto;
        padding: 10px;

        .card-item-env {
          width: 100%;
          text-align: center;
          background-color: #fbfbfb;
          padding: 10px 0px;
        }

        .card-item-appconfig {
          width: 100%;
          margin-top: 15px;

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

                .t-link-path {
                  text-decoration: none;
                  color: #303133;
                }

                .t-link-path:hover {
                  text-decoration: underline;
                }
              }
            }
          }

          .table-appconfig:hover {
            // border: 1px #f56c6c solid;
            box-shadow: 5px 5px 15px rgba(0, 0, 0, 0.2);
          }

          .table-appconfig-shadow-none {
            box-shadow: none !important;
          }
        }
      }

      &:hover {
        box-shadow: 0 2px 12px var(--next-color-dark-hover);
        transition: all ease 0.3s;
      }

      &-icon {
        width: 70px;
        height: 70px;
        border-radius: 100%;
        flex-shrink: 1;

        i {
          color: var(--el-text-color-placeholder);
        }
      }

      .log-content {
        box-sizing: border-box;
        background-color: #545c64;
        counter-reset: line-number;
        padding-right: 1em;
        text-align: left;
      }
    }

    /*
    .log-content p::before {
      counter-increment: line-number;
      content: counter(line-number) ".";
      display: inline-block;
      margin-right: 0.5em;
    }
    */
  }

  .publish-card-box {
    .publish-card-item {
      padding: 20px;
      cursor: pointer;
    }

    @for $i from 0 through 3 {
      .publish-animation#{$i} {
        opacity: 0;
        animation-name: error-num;
        animation-duration: 0.5s;
        animation-fill-mode: forwards;
        animation-delay: calc($i/4) + s;
      }
    }
  }

  .publish-card-config {
    .publish-card-item {
      height: calc(100vh - 260px);
      width: 100%;

      // overflow-y: auto;
      .card-item-box {
        height: 100%;
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

  .t-link-path {
    text-decoration: none;
    color: #409eff;
  }

  .t-link-path:hover {
    text-decoration: underline;
    cursor: pointer;
  }
}
</style>
