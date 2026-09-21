import type { UseFormRegister } from "react-hook-form";
import type { SettingsFormValues } from "./settingsForm";
import type { ModelSelectOption } from "./useSettingsModels";

type SettingsModelsFieldsProps = {
  register: UseFormRegister<SettingsFormValues>;
  chatModelOptions: ModelSelectOption[];
  imageModelOptions: ModelSelectOption[];
  videoModelOptions: ModelSelectOption[];
};

export const SettingsModelsFields = ({
  register,
  chatModelOptions,
  imageModelOptions,
  videoModelOptions,
}: SettingsModelsFieldsProps) => {
  return (
    <fieldset>
      <legend className="account-field-label">Models</legend>
      <div className="account-fields">
        <div>
          <label className="account-field-label" htmlFor="settings-chat-model">
            Chat model
          </label>
          <select
            id="settings-chat-model"
            className="account-select"
            {...register("model")}
          >
            <option value="default">Default model</option>
            {chatModelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="account-check-hint">
            Default model for plain text chats.
          </span>
        </div>
        <div>
          <label className="account-field-label" htmlFor="settings-image-model">
            Image generation model{" "}
            <span className="account-font-size-value">
              {imageModelOptions.length} capable
            </span>
          </label>
          <select
            id="settings-image-model"
            className="account-select"
            {...register("imageModel")}
          >
            <option value="default">Default model</option>
            {imageModelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="account-check-hint">
            Only image-capable models are listed. Image prompts use this
            automatically.
          </span>
        </div>
        <div>
          <label className="account-field-label" htmlFor="settings-video-model">
            Video generation model{" "}
            <span className="account-font-size-value">
              {videoModelOptions.length} capable
            </span>
          </label>
          <select
            id="settings-video-model"
            className="account-select"
            {...register("videoModel")}
          >
            <option value="default">Default model</option>
            {videoModelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="account-check-hint">
            Only video-capable models are listed. Video prompts use this
            automatically.
          </span>
        </div>
      </div>
    </fieldset>
  );
};

export default SettingsModelsFields;
