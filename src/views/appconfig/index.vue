<template>
  <div class="appconfig-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="appconfig-search">
        <el-row :gutter="15">
          <el-col :span="6">
            <el-select
              filterable
              placeholder="请选择项目管理"
              size="default"
              v-model="state.tableData.param.projectId"
            >
              <el-option
                v-for="project in projectList"
                :key="project.id"
                :label="project.name"
                :value="project.id"
              />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-select
              v-model="state.tableData.param.environment"
              placeholder="请选择环境"
              size="default"
            >
              <el-option label="Dev" :value="1" />
              <el-option label="Uat" :value="2" />
              <el-option label="Pro" :value="3" />
              <el-option label="Other" :value="4" />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-button size="default" type="primary" class="ml10" @click="onSearch">
              <el-icon>
                <ele-Search />
              </el-icon>
              查询
            </el-button>
            <el-button size="default" class="ml10" @click="onReset">
              <el-icon>
                <ele-RefreshLeft />
              </el-icon>
              重置
            </el-button>
          </el-col>
        </el-row>
      </div>
    </el-card>
    <el-card shadow="hover" class="layout-padding-auto">
      <template #header>
        <el-button size="default" type="success" @click="onOpenAppconfigDialog('add')">
          <el-icon>
            <ele-Plus />
          </el-icon>
          新增
        </el-button>
        <el-button
          size="default"
          type="danger"
          :disabled="selectedRows.length === 0"
          @click="onBatchDel"
        >
          <el-icon>
            <ele-Delete />
          </el-icon>
          批量删除
        </el-button>
        <el-button
          size="default"
          type="primary"
          :disabled="selectedRows.length === 0"
          :loading="exportLoading"
          @click="onExportSelected"
        >
          <el-icon><ele-Download /></el-icon>
          导出选中
        </el-button>
        <el-button
          size="default"
          type="primary"
          @click="onImportConfig"
        >
          <el-icon><ele-Upload /></el-icon>
          导入配置
        </el-button>
      </template>
      <el-table
        :data="state.tableData.data"
        v-loading="state.tableData.loading"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column fixed type="index" label="序号" width="60" />
        <el-table-column prop="projectName" label="项目名称" width="200" />
        <el-table-column prop="environment" label="环境" width="90">
          <template #default="scope">
            {{ displayEnvironment(scope.row.environment) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="dllMode"
          label="获取dll方式"
          min-width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="buildMode"
          label="获取模式"
          width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="msBuildPath"
          label="MsBuild路径"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="scope">
            <el-button
              size="small"
              text
              type="success"
              @click="onCopyAppconfig(scope.row)"
              >复制新增</el-button
            >
            <el-button
              size="small"
              text
              type="info"
              @click="onOpenAppconfigDialog('viewer', scope.row)"
              >查看</el-button
            >
            <!--
            <el-button size="small" text type="primary" @click="onBackup(scope.row)"
              >备份</el-button
            >
            -->
            <el-button
              size="small"
              text
              type="warning"
              @click="onOpenAppconfigDialog('edit', scope.row)"
              >修改</el-button
            >
            <el-button size="small" text type="danger" @click="onRowDel(scope.row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        @size-change="onHandleSizeChange"
        @current-change="onHandleCurrentChange"
        class="mt15"
        v-model:current-page="state.tableData.currentPage"
        background
        v-model:page-size="state.tableData.param.maxResultCount"
        layout="total, sizes, prev, pager, next, jumper"
        :total="state.tableData.total"
      >
      </el-pagination>
    </el-card>
    <appconfig-dialog ref="appconfigDialogRef" @refresh="getTableData()" />
    <backup-dialog ref="backupDialogRef" />
    <import-preview-dialog ref="importPreviewDialogRef" @confirm="onImportConfirm" />
  </div>
</template>

<script setup lang="ts" name="smomAppconfig">
import { ref, reactive, onBeforeMount, onMounted, defineAsyncComponent } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import _ from "lodash";
import { useProjectDb } from "@/database/project/index";
import { useAppconfigDb } from "@/database/appconfig/index";
import { displayEnvironment, aesEncrypt, aesDecrypt } from "@/utils/other";
// import { loadBackupItems } from "@/utils/backupAppconfig";
import { save, open } from "@tauri-apps/plugin-dialog";
import { cmdInvoke } from "@/utils/command";
import { useImportExportDb } from "@/database/import-export/index";

// 引入应用配置数据库
const appconfigDb = useAppconfigDb();
const projectDb = useProjectDb();

// 引入组件
const appconfigDialogRef = ref();
const AppconfigDialog = defineAsyncComponent(
  () => import("@/views/appconfig/components/appconfigDialog.vue")
);
const backupDialogRef = ref();
const BackupDialog = defineAsyncComponent(
  () => import("@/views/backups/components/backupDialog.vue")
);
const importPreviewDialogRef = ref();
const ImportPreviewDialog = defineAsyncComponent(
  () => import("@/views/appconfig/components/importPreviewDialog.vue")
);
const importExportDb = useImportExportDb();
const exportLoading = ref(false);

// 项目信息
const projectList = ref<RowProjectType[]>();
// 应用配置状态
const state = reactive<AppconfigState>({
  tableData: {
    data: [],
    total: 0,
    loading: false,
    currentPage: 1,
    param: {
      projectId: null,
      environment: null,
      sorting: "ta.id DESC",
      skipCount: 0,
      maxResultCount: 10,
    },
  },
});

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

// 搜索
const onSearch = async () => {
  state.tableData.currentPage = 1;
  await getTableData();
};

// 重置
const onReset = async () => {
  state.tableData.param.projectId = null;
  state.tableData.param.environment = null;
  await getProjectList();
};

// 初始化表格数据
const getTableData = async () => {
  state.tableData.loading = true;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;

  let dataResult = await appconfigDb.getAppconfigList(state.tableData.param);
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  state.tableData.data = dataResult.data.data;
  state.tableData.total = dataResult.data.total;
  state.tableData.loading = false;
};

// 分页改变时触发
const onHandleSizeChange = async (val: number) => {
  state.tableData.param.maxResultCount = val;
  await getTableData();
};

// 分页改变时触发
const onHandleCurrentChange = async (val: number) => {
  state.tableData.currentPage = val;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;
  await getTableData();
};

// 打开应用配置弹窗
const onOpenAppconfigDialog = (type: string, row: any = null) => {
  appconfigDialogRef.value.openDialog(type, row);
};

// 复制新增
const onCopyAppconfig = async (row: RowAppconfigType) => {
  const newRow = _.cloneDeep(row);
  newRow.projectId = null;
  let insertResult = await appconfigDb.insertAppconfig(newRow);
  if (insertResult.code === 0) {
    ElMessage.success("复制成功！");
    await getTableData();
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 备份
// const onBackup = async (row: RowAppconfigType) => {
//   if (!row.id) return;
//   var backupData = await loadBackupItems(row.id);
//   backupDialogRef.value.openDialog("add", backupData);
// };

// 多选
const selectedRows = ref<RowAppconfigType[]>([]);

const handleSelectionChange = (rows: RowAppconfigType[]) => {
  selectedRows.value = rows;
};

// 删除项目
const onRowDel = (row: RowAppconfigType) => {
  ElMessageBox.confirm(
    `此操作将永久删除应用配置：“${row.projectName}-${displayEnvironment(
      Number(row.environment)
    )}”，是否确认?`,
    "提示",
    {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
    }
  ).then(async () => {
    let dataResult = await appconfigDb.deleteAppconfig(Number(row.id));
    if (dataResult.code !== 0) {
      ElMessage.error(dataResult.msg);
      return;
    }
    await getTableData();
    ElMessage.success("删除成功");
  });
};

// 批量删除
const onBatchDel = () => {
  const names = selectedRows.value
    .map(
      (r) =>
        `${r.projectName}-${displayEnvironment(Number(r.environment))}`
    )
    .join("、");
  ElMessageBox.confirm(
    `此操作将永久删除以下应用配置：【${names}】，是否确认?`,
    "批量删除",
    {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
    }
  ).then(async () => {
    const ids = selectedRows.value.map((r) => Number(r.id));
    for (const id of ids) {
      await appconfigDb.deleteAppconfig(id);
    }
    selectedRows.value = [];
    await getTableData();
    ElMessage.success("批量删除成功");
  });
};

// 导出选中
const onExportSelected = async () => {
  if (selectedRows.value.length === 0) return;

  exportLoading.value = true;
  try {
    // 1. 收集数据
    const ids = selectedRows.value.map((r) => Number(r.id));
    const items = await importExportDb.collectExportData(ids);

    if (items.length === 0) {
      ElMessage.warning("没有可导出的数据");
      return;
    }

    // 2. 组装 ExportFile
    const exportFile: ExportFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
    };

    // 3. 加密
    const jsonStr = JSON.stringify(exportFile);
    const encrypted = await aesEncrypt(jsonStr);
    if (!encrypted) {
      ElMessage.error("加密数据失败");
      return;
    }

    // 4. 保存对话框
    const dateStr = new Date().toISOString().slice(0, 10);
    const filePath = await save({
      defaultPath: `SMOM-Config-export-${dateStr}.smomconfig`,
      filters: [{ name: "SMOM配置", extensions: ["smomconfig"] }],
    });
    if (!filePath) {
      ElMessage.info("您已取消保存");
      return;
    }

    // 5. 写文件
    const saveResult = await cmdInvoke("save_content_to_file", {
      content: encrypted,
      filePath,
    });
    if (saveResult.code !== 0) {
      ElMessage.error(`保存文件失败：${saveResult.data}`);
      return;
    }

    // 6. 提示
    const skipped = ids.length - items.length;
    if (skipped > 0) {
      ElMessage.warning(`导出完成：成功 ${items.length} 条，跳过 ${skipped} 条`);
    } else {
      ElMessage.success(`导出成功，共 ${items.length} 个应用配置`);
    }
  } catch (err) {
    console.error("导出失败:", err);
    ElMessage.error("导出失败：" + (err as Error).message);
  } finally {
    exportLoading.value = false;
  }
};

// 暂存待导入的完整数据（在 onImportConfig 解析后设置，onImportConfirm 使用）
let _pendingImportItems: ExportItem[] = [];

// 导入配置
const onImportConfig = async () => {
  try {
    // 1. 打开文件对话框
    const filePath = await open({
      multiple: false,
      filters: [{ name: "SMOM配置", extensions: ["smomconfig"] }],
    });
    if (!filePath) {
      return;
    }

    // 2. 读取文件
    const readResult = await cmdInvoke<string>("read_content_to_file", {
      filePath: String(filePath),
    });
    if (readResult.code !== 0) {
      ElMessage.error(`读取文件失败：${readResult.data}`);
      return;
    }

    // 3. 解密
    const decrypted = await aesDecrypt(String(readResult.data));
    if (!decrypted) {
      ElMessage.error("文件格式不正确或已损坏");
      return;
    }

    // 4. 解析 JSON
    let exportFile: ExportFile;
    try {
      exportFile = JSON.parse(decrypted);
    } catch {
      ElMessage.error("文件格式不正确或已损坏");
      return;
    }

    // 5. 版本检查
    if (exportFile.version !== 1) {
      ElMessage.error(`文件版本不兼容，当前支持 v1，文件为 v${exportFile.version}`);
      return;
    }

    if (!exportFile.items || exportFile.items.length === 0) {
      ElMessage.warning("文件中没有可导入的数据");
      return;
    }

    // 6. 冲突检测
    const previewItems = await importExportDb.checkImportConflicts(exportFile.items);

    // 暂存完整数据供确认回调使用
    _pendingImportItems = exportFile.items;
    // 7. 显示预览弹窗
    importPreviewDialogRef.value.openDialog(
      String(filePath).split(/[\\/]/).pop() || "unknown",
      exportFile.exportedAt,
      previewItems
    );
  } catch (err) {
    console.error("导入失败:", err);
    ElMessage.error("导入失败：" + (err as Error).message);
  }
};

// 导入确认回调
const onImportConfirm = async (previewItems: ImportPreviewItem[]) => {
  const dialog = importPreviewDialogRef.value;
  dialog.setImporting(true);

  try {
    const items = _pendingImportItems;
    const total = items.length;

    // 逐条导入
    const results: ImportResult[] = [];
    for (let i = 0; i < total; i++) {
      const batchResult = await importExportDb.executeImport([items[i]]);
      results.push(...batchResult);
      dialog.setProgress(Math.round(((i + 1) / total) * 100));
    }

    // 汇总
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (failed === 0) {
      dialog.setProgress(100, "success");
      ElMessage.success(`导入成功，共 ${succeeded} 条`);
    } else if (succeeded > 0) {
      dialog.setProgress(100, "exception");
      ElMessage.warning(`成功 ${succeeded} 条，失败 ${failed} 条`);
    } else {
      dialog.setProgress(100, "exception");
      ElMessage.error(`全部导入失败`);
    }

    dialog.closeDialog();
    await getTableData();
    await getProjectList();
  } catch (err) {
    console.error("导入执行失败:", err);
    ElMessage.error("导入执行失败：" + (err as Error).message);
  } finally {
    dialog.setImporting(false);
  }
};

onBeforeMount(async () => {
  await getProjectList();
});

onMounted(async () => {
  await getTableData();
});
</script>

<style scoped lang="scss">
.appconfig-container {
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;
    .el-table {
      flex: 1;
    }
  }
}
</style>
