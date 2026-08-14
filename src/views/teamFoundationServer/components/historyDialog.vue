<template>
  <div class="history-container">
    <el-dialog :title="state.dialog.title" v-model="state.dialog.show" :close-on-click-modal="false"
      modal-class="history-dialog" draggable width="680px">
      <el-form ref="historyDialogFormRef" size="default" label-width="90px" :model="state.ruleForm" :rules="formRules">
        <el-row :gutter="10">
          <el-col :span="24" class="mb20">
            <el-form-item label="TFS名称">
              <el-input v-model="state.ruleForm.tfsName" maxlength="50" clearable :disabled="true"
                placeholder="请输入TFS名称"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="14" class="mb20">
            <el-form-item label="服务地址">
              <el-input v-model="state.ruleForm.tfsServerUrl" maxlength="500" clearable :disabled="true"
                placeholder="请输入TFS服务地址"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="10" class="mb20">
            <el-form-item label="源位置">
              <el-input v-model="state.ruleForm.tfsSourcePath" maxlength="150" clearable :disabled="true"
                placeholder="请输入TFS源位置"></el-input>
            </el-form-item>
          </el-col>
          <fieldset class="form-tfs-fieldset">
            <legend class="form-tfs-legend">筛选条件</legend>
            <el-row :gutter="0">
              <el-col :span="24" class="mb10" style="text-align: center">
                <div class="history-filter-item">
                  <el-radio-group v-model="historyParams.historyModel" @change="onHistoryModelChange">
                    <el-radio-button label="日期" value="日期" />
                    <el-radio-button label="变更集" value="变更集" />
                  </el-radio-group>
                </div>
              </el-col>
              <el-col :span="11" class="mb10">
                <el-form-item :label="historyParams.historyModel">
                  <el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
                    v-model="historyParams.historyValue[0].value" type="datetime"
                    :default-time="DEFAULT_DATE_TIME_START"
                    :placeholder="historyParams.historyValue[0].placeholder" />
                  <el-input v-else v-model="historyParams.historyValue[0].value"
                    :placeholder="historyParams.historyValue[0].placeholder" maxlength="150" clearable></el-input>
                </el-form-item>
              </el-col>
              <el-col :span="1" class="mb10">
                <div class="range-separator">~</div>
              </el-col>
              <el-col :span="11" class="mb10">
                <el-form-item label-width="0px">
                  <el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
                    v-model="historyParams.historyValue[1].value" type="datetime"
                    :default-time="DEFAULT_DATE_TIME_END"
                    :placeholder="historyParams.historyValue[1].placeholder" />
                  <el-input v-else v-model="historyParams.historyValue[1].value"
                    :placeholder="historyParams.historyValue[1].placeholder" maxlength="150" clearable></el-input>
                </el-form-item>
              </el-col>
              <el-col :span="23" class="mb10">
                <el-form-item label="用户">
                  <el-input v-model="historyParams.user" maxlength="50" clearable placeholder="请输入用户名称(选填)"></el-input>
                </el-form-item>
              </el-col>
            </el-row>
          </fieldset>
        </el-row>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default">取 消</el-button>
          <el-button type="primary" :loading="state.dialog.submitTxt === '执行中'"
            @click="submitValidate(historyDialogFormRef)" size="default">{{ state.dialog.submitTxt }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="historyDialog">
import { reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { cmdInvoke } from "@/utils/command";
import { getDefaultSubObject } from "@/utils/other";
import { formatDate, DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END } from "@/utils/formatTime";

// 定义变量内容
const historyDialogFormRef = ref();
const historyParams = ref({
  historyModel: "日期",
  historyValue: [
    {
      placeholder: "开始日期(必填)",
      value: "",
    },
    {
      placeholder: "结束日期(选填，空则表示为最新日期)",
      value: "",
    },
  ],
  user: "",
});
const state = reactive<FormDialogType<RowTfsType>>({
  ruleForm: {
    id: null,
    tfsName: null,
    tfsServerUrl: null,
    tfsSourcePath: null,
    tfsLocalPath: null,
    tfvcPath: null,
    remark: null,
  },
  dialog: {
    show: false,
    type: "viewer",
    editId: null,
    title: "TFS记录",
    submitTxt: "查 询",
  },
});

// 表单验证规则
const formRules = reactive<FormRules>({
  historyName: [{ required: true, message: "请输入TFS名称！", trigger: "blur" }],
  historyServerUrl: [{ required: true, message: "请输入TFS服务地址！", trigger: "blur" }],
  historySourcePath: [{ required: true, message: "请输入TFS源位置！", trigger: "blur" }],
  tfvcPath: [{ required: true, message: "请输入TFVC工具路径！", trigger: "blur" }],
});

// TFS记录筛选条件变化
const onHistoryModelChange = (val: string) => {
  historyParams.value.historyModel = val;
  const { start, end } = getWeekStartEnd();
  if (val === "日期") {
    historyParams.value.historyValue = [
      {
        placeholder: "开始日期(必填)",
        value: start,
      },
      {
        placeholder: "结束日期(选填，空则表示为最新日期)",
        value: end,
      },
    ];
  } else {
    historyParams.value.historyValue = [
      {
        placeholder: "变更集(必填)",
        value: "",
      },
      {
        placeholder: "变更集(选填，空则表示为最新变更集)",
        value: "",
      },
    ];
  }
};

// 提交验证
const submitValidate = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    if (valid) {
      onSubmit();
    } else {
      console.warn("未验证通过!", fields);
    }
  });
};

// 提交
const onSubmit = async () => {
  // 验证
  if (!historyParams.value.historyValue[0].value) {
    ElMessage.error(`${historyParams.value.historyValue[0].placeholder}不能为空！`);
    return;
  }
  state.dialog.submitTxt = "执行中";
  // 构造命令行
  let execArgs = new Array<string>();
  execArgs.push("history");
  execArgs.push(`/collection:${state.ruleForm.tfsServerUrl}`);
  execArgs.push(`${state.ruleForm.tfsSourcePath}`);
  if (historyParams.value.historyModel === "日期") {
    let sDate = new Date(historyParams.value.historyValue[0].value);
    const beginDate = formatDate(sDate, "DYYYY-mm-ddTHH:MM:SS");
    let endDate = "";
    if (historyParams.value.historyValue[1].value) {
      let eDate = new Date(historyParams.value.historyValue[1].value);
      endDate = formatDate(eDate, "DYYYY-mm-ddTHH:MM:SS");
    }
    execArgs.push(`-V:${beginDate}~${endDate}`);
  }
  if (historyParams.value.historyModel === "变更集") {
    const beginChangeSets = `C${historyParams.value.historyValue[0].value}`;
    let endChangeSets = "";
    if (historyParams.value.historyValue[1].value) {
      endChangeSets = `C${historyParams.value.historyValue[1].value}`;
    }
    execArgs.push(`-V:${beginChangeSets}~${endChangeSets}`);
  }
  if (historyParams.value.user) {
    execArgs.push(`-U:${historyParams.value.user}`);
  }
  execArgs.push("-R");
  execArgs.push("-F:detailed");
  const execResult = await cmdInvoke("exec_local_command_spawn", {
    command: state.ruleForm.tfvcPath,
    args: execArgs,
  });
  if (execResult.code !== 0) {
    ElMessage.error(`命令执行失败：${execResult.data}`);
  }
  state.dialog.submitTxt = "查 询";
};

// 打开弹窗
const openDialog = (type: string, row: RowTfsType) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.dialog.editId = null;
  state.dialog.type = "viewer";
  state.dialog.editId = row.id;
  Object.assign(state.ruleForm, row);
  const { start, end } = getWeekStartEnd();
  historyParams.value.historyValue[0].value = start;
  historyParams.value.historyValue[1].value = end;
  /* End: 重置表单内容 */
  state.dialog.show = true;
  console.log("操作类型：" + type);
};

// 获取本周的开始和结束时间
const getWeekStartEnd = () => {
  const now = new Date(); // 当前时间
  const day = now.getDay(); // 星期几 (0 - 周日, 1 - 周一, ..., 6 - 周六)
  const diffToMonday = day === 0 ? 6 : day - 1; // 计算距离周一的天数差

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday); // 设置为本周周一
  weekStart.setHours(0, 0, 0, 0); // 设置时间为 00:00:00

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // 周日
  weekEnd.setHours(23, 59, 59, 999); // 设置时间为 23:59:59

  return {
    start: formatDate(weekStart, "YYYY-mm-dd HH:MM:SS"),
    end: formatDate(weekEnd, "YYYY-mm-dd HH:MM:SS"),
  };
};

// 关闭弹窗
const closeDialog = () => {
  state.dialog.show = false;
};

// 取消
const onCancel = () => {
  closeDialog();
};

// 暴露变量
defineExpose({
  openDialog,
});
</script>
<style lang="scss">
.el-overlay .el-overlay-dialog .el-dialog .el-dialog__body {
  padding: 0px !important;
}

.form-tfs-fieldset {
  .el-radio-button__inner {
    min-width: 85px !important;
  }
}
</style>

<style lang="scss" scoped>
.tfvc-info-text {
  margin-top: 15px;
  padding: 5px;
  background-color: #eef0f4;
  border-radius: 2px;
  word-wrap: break-word;
  word-break: break-all;
  line-height: 20px;
}

.form-tfs-fieldset {
  width: 100%;
  border: 1px #dcdfe6 solid;
  padding-top: 2px;
  margin: 0px 5px;

  .history-filter-item {
    text-align: center;
  }
}

.form-tfs-legend {
  padding: 0px 5px;
  margin-left: 15px;
}

.range-separator {
  text-align: center;
  height: 32px;
  line-height: 32px;
}
</style>
