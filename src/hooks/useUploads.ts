import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api';

export function useUploadReceiptMutation() {
  return useMutation({
    mutationFn: (file: File) => apiClient.uploads.uploadReceipt(file),
  });
}

export function useUploadAvatarMutation() {
  return useMutation({
    mutationFn: (file: File) => apiClient.uploads.uploadAvatar(file),
  });
}
