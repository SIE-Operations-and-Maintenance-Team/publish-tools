<template>
  <div class="project-container">
    <el-dialog
      :title="state.dialog.title"
      v-model="state.dialog.show"
      :close-on-click-modal="false"
      modal-class="project-dialog"
      draggable
      width="650px"
    >
      <el-form
        ref="projectDialogFormRef"
        :model="state.ruleForm"
        :rules="formRules"
        size="default"
        label-width="90px"
      >
        <el-row :gutter="10">
          <el-col :span="12" class="mb20">
            <el-form-item label="项目编码" prop="code">
              <el-input
                v-model="state.ruleForm.code"
                placeholder="请输入项目编码"
                maxlength="20"
                clearable
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="项目名称" prop="name">
              <el-input
                v-model="state.ruleForm.name"
                placeholder="请输入项目名称"
                maxlength="50"
                clearable
              ></el-input>
            </el-form-item>
          </el-col>

          <el-col :span="6" class="mb20">
            <el-form-item label="是否默认" prop="isDefault">
              <el-switch
                v-model="state.ruleForm.isDefault"
                :active-value="1"
                :inactive-value="0"
                inline-prompt
                active-text="是"
                inactive-text="否"
                size="default"
              />
            </el-form-item>
          </el-col>
          <el-col :span="18" class="mb20">
            <el-form-item label-width="110" label="程序集输出路径" prop="assemblyOutPath">
              <el-input
                v-model="state.ruleForm.assemblyOutPath"
                placeholder="请输入程序集输出路径"
                maxlength="450"
                clearable
              ></el-input>
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
            @click="submitValidate(projectDialogFormRef)"
            size="default"
            >{{ state.dialog.submitTxt }}</el-button
          >
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="projectDialog">
import { nextTick, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import _ from "lodash";
import { getDefaultSubObject } from "@/utils/other";
import { useProjectDb } from "@/database/project/index";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh"]);

// 引入项目管理数据库
const projectDb = useProjectDb();

// 定义变量内容
const projectDialogFormRef = ref();
const state = reactive<FormDialogType<RowProjectType>>({
  ruleForm: {
    id: null,
    code: null,
    name: null,
    description: null,
    isDefault: 0,
    assemblyOutPath: null,
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
  code: [{ required: true, message: "请输入项目编码！", trigger: "blur" }],
  name: [{ required: true, message: "请输入项目名称！", trigger: "blur" }],
  os: [{ required: true, message: "请选择系统！", trigger: "blur" }],
  environment: [{ required: true, message: "请选择环境！", trigger: "blur" }],
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
const openDialog = (type: string, row: RowProjectType) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.dialog.editId = null;
  state.dialog.type = "add";
  /* End: 重置表单内容 */
  nextTick(() => {
    if (type === "edit") {
      state.dialog.type = "edit";
      state.dialog.editId = row.id;
      Object.assign(state.ruleForm, row);
      state.dialog.title = "修改项目";
      state.dialog.submitTxt = "修 改";
    } else {
      state.dialog.title = "新增项目";
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
    let updateResult = await projectDb.updateProject(state.ruleForm);
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
  let insertResult = await projectDb.insertProject(state.ruleForm);
  if (insertResult.code === 0) {
    ElMessage.success("添加成功！");
    closeDialog(); // 关闭弹窗
    emit("refresh");
  } else {
    ElMessage.error(insertResult.msg);
  }
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
