import { useEffect, useMemo, useState } from "react";
import type { ModelOption } from "./ModelMenu";

type UseModelMenuListOptions = {
  modelOptions: ModelOption[];
  menuOpen: boolean;
  modelMenuOpen: boolean;
  onModelChange: (value: string) => void;
  onModelMenuOpenChange: (open: boolean) => void;
  onCloseMenu: () => void;
  onResearchSelect?: () => void;
  onArtifactSelect?: () => void;
};

export const useModelMenuList = ({
  modelOptions,
  menuOpen,
  modelMenuOpen,
  onModelChange,
  onModelMenuOpenChange,
  onCloseMenu,
  onResearchSelect,
  onArtifactSelect,
}: UseModelMenuListOptions) => {
  const [modelQuery, setModelQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  // Research mode: list only deep-research-capable models.
  const [researchOnly, setResearchOnly] = useState(false);
  const [imageOnly, setImageOnly] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      setModelQuery("");
      setSortOpen(false);
      setResearchOnly(false);
      setImageOnly(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!modelMenuOpen) {
      setModelQuery("");
      setSortOpen(false);
      setResearchOnly(false);
      setImageOnly(false);
    }
  }, [modelMenuOpen]);

  const researchOptions = useMemo(
    () => modelOptions.filter((option) => option.supportsResearch),
    [modelOptions]
  );

  const imageOptions = useMemo(
    () => modelOptions.filter((option) => option.supportsImage),
    [modelOptions]
  );

  const visibleOptions = researchOnly
    ? researchOptions
    : imageOnly
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
    setResearchOnly(false);
    setImageOnly(false);
    onModelMenuOpenChange(true);
  };

  const openResearchList = () => {
    setModelQuery("");
    setResearchOnly(true);
    setImageOnly(false);
    onModelMenuOpenChange(true);
  };

  const openImageList = () => {
    setModelQuery("");
    setResearchOnly(false);
    setImageOnly(true);
    onModelMenuOpenChange(true);
  };

  const closeModelList = () => {
    setModelQuery("");
    setResearchOnly(false);
    setImageOnly(false);
    onModelMenuOpenChange(false);
  };

  const selectModel = (value: string) => {
    onModelChange(value);
    if (researchOnly) onResearchSelect?.();
    setModelQuery("");
    setResearchOnly(false);
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
    researchOnly,
    imageOnly,
    researchOptions,
    imageOptions,
    visibleOptions,
    filtered,
    openModelList,
    openResearchList,
    openImageList,
    closeModelList,
    selectModel,
    selectArtifact,
  };
};

export type ModelMenuListApi = ReturnType<typeof useModelMenuList>;
