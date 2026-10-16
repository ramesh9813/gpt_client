import { useEffect, useMemo, useState } from "react";
import type { ModelOption } from "./ModelMenu";

type UseModelMenuListOptions = {
  modelOptions: ModelOption[];
  menuOpen: boolean;
  modelMenuOpen: boolean;
  onModelChange: (value: string) => void;
  onModelMenuOpenChange: (open: boolean) => void;
  onCloseMenu: () => void;
  onArtifactSelect?: () => void;
};

export const useModelMenuList = ({
  modelOptions,
  menuOpen,
  modelMenuOpen,
  onModelChange,
  onModelMenuOpenChange,
  onCloseMenu,
  onArtifactSelect,
}: UseModelMenuListOptions) => {
  const [modelQuery, setModelQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [imageOnly, setImageOnly] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      setModelQuery("");
      setSortOpen(false);
      setImageOnly(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!modelMenuOpen) {
      setModelQuery("");
      setSortOpen(false);
      setImageOnly(false);
    }
  }, [modelMenuOpen]);

  const imageOptions = useMemo(
    () => modelOptions.filter((option) => option.supportsImage),
    [modelOptions]
  );

  const visibleOptions = imageOnly
    ? imageOptions
    : modelOptions;

  const filtered = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return visibleOptions;
    return visibleOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q)
    );
  }, [visibleOptions, modelQuery]);

  const openModelList = () => {
    setModelQuery("");
    setImageOnly(false);
    onModelMenuOpenChange(true);
  };

  const openImageList = () => {
    setModelQuery("");
    setImageOnly(true);
    onModelMenuOpenChange(true);
  };

  const closeModelList = () => {
    setModelQuery("");
    setImageOnly(false);
    onModelMenuOpenChange(false);
  };

  const selectModel = (value: string) => {
    onModelChange(value);
    setModelQuery("");
    setImageOnly(false);
    onModelMenuOpenChange(false);
    onCloseMenu();
  };

  const selectArtifact = () => {
    // Arm artifact mode only — never auto-send. The user reviews/edits the
    // prompt, then hits Send (mirrors researchArmed one-shot pattern).
    onArtifactSelect?.();
    onCloseMenu();
  };

  return {
    modelQuery,
    setModelQuery,
    sortOpen,
    setSortOpen,
    imageOnly,
    filtered,
    openModelList,
    openImageList,
    closeModelList,
    selectModel,
    selectArtifact,
  };
};

export type ModelMenuListApi = ReturnType<typeof useModelMenuList>;
