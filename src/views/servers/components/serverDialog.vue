<template>
  <div class="server-container">
    <el-dialog
      :title="state.dialog.title"
      v-model="state.dialog.show"
      :close-on-click-modal="false"
      modal-class="server-dialog"
      draggable
      width="650px"
    >
      <el-form
        ref="serverDialogFormRef"
        :model="state.ruleForm"
        :rules="formRules"
        size="default"
        label-width="100px"
      >
        <el-row :gutter="10">
          <el-col :span="24" class="mb20">
            <el-form-item label="服务器名称" prop="name">
              <el-input
                v-model="state.ruleForm.name"
                placeholder="请输入服务器名称"
                maxlength="50"
                clearable
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="IP" prop="ip">
              <el-input
                v-model="state.ruleForm.ip"
                placeholder="请输入IP地址"
                maxlength="20"
                clearable
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="SSH端口" prop="port">
              <el-input
                v-model="state.ruleForm.port"
                placeholder="请输入SSH端口"
                maxlength="5"
                clearable
                @input="
                  state.ruleForm.port = Number(
                    verifiyNumberInteger(String(state.ruleForm.port))
                  )
                "
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="账号" prop="account">
              <el-input
                v-model="state.ruleForm.account"
                placeholder="请输入账号"
                maxlength="30"
                clearable
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="密码" prop="account">
              <el-input
                type="password"
                show-password
                v-model="state.ruleForm.pwd"
                placeholder="请输入密码"
                maxlength="50"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="服务环境" prop="os">
              <el-select v-model="state.ruleForm.os" placeholder="请选择服务环境">
                <el-option label="Windows" :value="1" />
                <el-option label="Docker" :value="2" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="所属项目" prop="projectId">
              <el-select
                filterable
                placeholder="请选择所属项目"
                size="default"
                v-model="state.ruleForm.projectId"
              >
                <el-option
                  v-for="project in projectList"
                  :key="project.id"
                  :label="project.name"
                  :value="project.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label="描述" prop="description">
              <el-input
                type="textarea"
                v-model="state.ruleForm.description"
                rows="3"
                placeholder="请输入描述内容…"
                maxlength="150"
                show-word-limit
                clearable
              ></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default">取 消</el-button>
          <el-button
            type="primary"
            @click="submitValidate(serverDialogFormRef)"
            size="default"
            >{{ state.dialog.submitTxt }}</el-button
          >
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="serverDialog">
import { nextTick, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import _ from "lodash";
import { useServerDb } from "@/database/servers/index";
import { useProjectDb } from "@/database/project/index";
import { getDefaultSubObject } from "@/utils/other";
import { verifiyNumberInteger } from "@/utils/toolsValidate";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh"]);

// 引入服务器管理数据库
const serverDb = useServerDb();
const projectDb = useProjectDb();

// 定义变量内容
const serverDialogFormRef = ref();
const projectList = ref<RowProjectType[]>();

const state = reactive<FormDialogType<RowServerType>>({
  ruleForm: {
    id: null,
    projectId: null,
    projectName: null,
    name: "",
    os: 1,
    ip: "",
    port: 22,
    account: "",
    pwd: "",
    description: null,
  },
  dialog: {
    show: false,
    type: "add",
    editId: null,
    title: "提示",
    submitTxt: "确定",
  },
});

// 表单验证规则
const formRules = reactive<FormRules>({
  // projectId: [{ required: true, message: "请选择所属项目！", trigger: "blur" }],
  name: [{ required: true, message: "请选择服务器名称！", trigger: "blur" }],
  os: [{ required: true, message: "请选择系统！", trigger: "blur" }],
  ip: [{ required: true, message: "请输入IP地址！", trigger: "blur" }],
  port: [{ required: true, message: "请输入端口！", trigger: "blur" }],
  account: [{ required: true, message: "请输入登录账号！", trigger: "blur" }],
  pwd: [{ required: true, message: "请输入登录密码！", trigger: "blur" }],
});

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

// 打开弹窗
const openDialog = async (type: string, row: RowServerType) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  if (state.ruleForm.projectId == 0) state.ruleForm.projectId = null;
  if (state.ruleForm.os == 0) state.ruleForm.os = 1;
  if (state.ruleForm.port == 0) state.ruleForm.port = 22;
  state.dialog.editId = null;
  state.dialog.type = "add";
  /* End: 重置表单内容 */
  await getProjectList();
  nextTick(() => {
    if (type === "edit") {
      state.dialog.type = "edit";
      state.dialog.editId = row.id;
      Object.assign(state.ruleForm, row);
      state.dialog.title = "修改服务器";
      state.dialog.submitTxt = "修 改";
    } else {
      state.dialog.title = "新增服务器";
      state.dialog.submitTxt = "新 增";
    }
    state.dialog.show = true;
  });
};

// 关闭弹窗
const closeDialog = () => {
  state.dialog.show = false;
};

// 取消
const onCancel = () => {
  closeDialog();
};

// 提交
const onSubmit = async () => {
  if (state.dialog.type == "edit") {
    // 修改
    let updateResult = await serverDb.updateServer(state.ruleForm);
    if (updateResult.code === 0) {
      ElMessage.success("修改成功！");
      closeDialog(); // 关闭弹窗
      emit("refresh");
    } else {
      ElMessage.error(updateResult.msg);
    }
    return;
  }

  // 添加
  let insertResult = await serverDb.insertServer(state.ruleForm);
  if (insertResult.code === 0) {
    ElMessage.success("添加成功！");
    closeDialog(); // 关闭弹窗
    emit("refresh");
  } else {
    ElMessage.error(insertResult.msg);
  }
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

// 暴露变量
defineExpose({
  openDialog,
});
</script>
<style lang="scss">
.el-overlay .el-overlay-dialog .el-dialog .el-dialog__body {
  padding: 0px !important;
}
</style>
