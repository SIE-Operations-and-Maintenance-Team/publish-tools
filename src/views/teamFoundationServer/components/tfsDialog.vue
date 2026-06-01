<template>
  <div class="tfs-container">
    <el-dialog :title="state.dialog.title" v-model="state.dialog.show" :close-on-click-modal="false"
      modal-class="tfs-dialog" draggable width="680px">
      <el-form ref="tfsDialogFormRef" size="default" label-width="110px" :model="state.ruleForm" :rules="formRules"
        :disabled="state.dialog.type == 'viewer'">
        <el-row :gutter="10">
          <el-col :span="24" class="mb20">
            <el-form-item label="TFS名称" prop="tfsName">
              <el-input v-model="state.ruleForm.tfsName" maxlength="50" clearable placeholder="请输入TFS名称"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="14" class="mb20">
            <el-form-item label="服务地址" prop="tfsServerUrl">
              <el-input v-model="state.ruleForm.tfsServerUrl" maxlength="500" clearable
                placeholder="请输入TFS服务地址"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="10" class="mb20">
            <el-form-item label="源位置" prop="tfsSourcePath">
              <el-input v-model="state.ruleForm.tfsSourcePath" maxlength="150" clearable
                placeholder="请输入TFS源位置"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label="本地根目录" prop="tfsLocalPath">
              <el-input v-model="state.ruleForm.tfsLocalPath" maxlength="500" clearable
                placeholder="请输入TFS本地根目录"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="TFVC工具" prop="tfvcPath">
              <el-input v-model="state.ruleForm.tfvcPath" maxlength="500" clearable
                placeholder="请输入TFVC工具路径"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label="">
              <div class="tfvc-info-text">
                <el-text type="info"># TFVC工具(TF.exe)<br />如：Visual Studio 2022 的 TF.exe
                  工具位于：{盘符}:\Program Files\Microsoft Visual
                  Studio\2022\{Edition}\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team
                  Explorer\TF.exe</el-text>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label-width="0">
              <el-input type="textarea" v-model="state.ruleForm.remark" rows="3" placeholder="请输入备注信息…" maxlength="150"
                show-word-limit clearable></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default">取 消</el-button>
          <el-button v-if="state.dialog.type !== 'viewer'" type="primary" @click="submitValidate(tfsDialogFormRef)"
            size="default">{{ state.dialog.submitTxt }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="tfsDialog">
import { nextTick, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { getDefaultSubObject } from "@/utils/other";
import { useTfsDb } from "@/database/teamFoundationServer/index";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh"]);

// 引入TFS数据库
const tfsDb = useTfsDb();

// 定义变量内容
const tfsDialogFormRef = ref();
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
    type: "add",
    editId: null,
    title: "新增TFS",
    submitTxt: "确 定",
  },
});

// 表单验证规则
const formRules = reactive<FormRules>({
  tfsName: [{ required: true, message: "请输入TFS名称！", trigger: "blur" }],
  tfsServerUrl: [{ required: true, message: "请输入TFS服务地址！", trigger: "blur" }],
  tfsSourcePath: [{ required: true, message: "请输入TFS源位置！", trigger: "blur" }],
  tfsLocalPath: [{ required: true, message: "请输入本地根目录！", trigger: "blur" }],
  tfvcPath: [{ required: true, message: "请输入TFVC工具路径！", trigger: "blur" }],
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

// 提交
const onSubmit = async () => {
  if (state.dialog.type == "edit") {
    // 修改
    let updateResult = await tfsDb.updateTfs(state.ruleForm);
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
  let insertResult = await tfsDb.insertTfs(state.ruleForm);
  if (insertResult.code === 0) {
    ElMessage.success("添加成功！");
    closeDialog(); // 关闭弹窗
    emit("refresh");
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 打开弹窗
const openDialog = (type: string, row: RowTfsType) => {
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
      state.dialog.title = "修改TFS";
      state.dialog.submitTxt = "修 改";
    } else {
      state.dialog.title = "新增TFS";
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

<style lang="scss" scoped>
:deep(.el-form-item__label) {
  white-space: nowrap;
}

.tfvc-info-text {
  margin-top: 15px;
  padding: 5px;
  background-color: #eef0f4;
  border-radius: 2px;
  word-wrap: break-word;
  word-break: break-all;
  line-height: 20px;
}
</style>
