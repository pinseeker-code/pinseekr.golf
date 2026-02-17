import { useMutation } from "@tanstack/react-query";
import { BlossomUploader } from '@nostrify/nostrify/uploaders';
import { useCurrentUser } from "./useCurrentUser";

/**
 * Maximum file sizes (in bytes)
 */
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB for images
  video: 100 * 1024 * 1024, // 100MB for videos
  document: 50 * 1024 * 1024, // 50MB for documents
  default: 25 * 1024 * 1024, // 25MB default
};

/**
 * Supported MIME types - kept as reference for validation
 */
const SUPPORTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  video: ['video/mp4', 'video/webm'],
  document: ['application/pdf'],
};

const BLOSSOM_SERVERS = [
  'https://blossom.primal.net/', // Primary
  'https://blossom.nos.lol/', // Fallback 1
  'https://cdn.satellite.earth/', // Fallback 2
];

/**
 * Get file size limit based on MIME type
 */
function getFileSizeLimit(mimeType: string): number {
  if (mimeType.startsWith('image/')) return FILE_SIZE_LIMITS.image;
  if (mimeType.startsWith('video/')) return FILE_SIZE_LIMITS.video;
  if (mimeType.startsWith('application/')) return FILE_SIZE_LIMITS.document;
  return FILE_SIZE_LIMITS.default;
}

/**
 * Validate file before upload (BUD-06 pre-flight check)
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  const sizeLimit = getFileSizeLimit(file.type);
  if (file.size > sizeLimit) {
    const limitMB = (sizeLimit / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `File too large. Maximum size: ${limitMB}MB` };
  }

  // Check MIME type
  const allValidTypes = [...SUPPORTED_MIME_TYPES.image, ...SUPPORTED_MIME_TYPES.video, ...SUPPORTED_MIME_TYPES.document];

  if (file.type && !allValidTypes.includes(file.type)) {
    return { valid: false, error: `Unsupported file type: ${file.type}` };
  }

  return { valid: true };
}

/**
 * Compress image for web (optional optimization)
 * Returns a new File with optimized settings, or original file if optimization fails
 */
async function optimizeImage(file: File): Promise<File> {
  try {
    // Only optimize if it's a large image
    if (!file.type.startsWith('image/') || file.size < 1024 * 1024) {
      return file; // Keep original if small
    }

    // Use canvas API to recompress
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    return new Promise((resolve) => {
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(file);
            return;
          }

          // Scale down if very large (max 2000px on longest side)
          const maxDim = 2000;
          let width = img.width;
          let height = img.height;
          
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with quality reduction
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              if (!blob) {
                resolve(file);
                return;
              }

              // Only use optimized version if it's smaller
              if (blob.size < file.size) {
                const optimized = new File([blob], file.name, { 
                  type: 'image/jpeg',
                  lastModified: file.lastModified 
                });
                resolve(optimized);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8 // 80% quality
          );
        } catch {
          URL.revokeObjectURL(url);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };

      img.src = url;
    });
  } catch {
    return file; // Return original on any error
  }
}

export function useUploadFile() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (file: File, options?: { optimize?: boolean }) => {
      if (!user) {
        throw new Error('Must be logged in to upload files');
      }

      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'File validation failed');
      }

      // Optimize image if requested (default: true for images)
      let uploadFile = file;
      if (options?.optimize !== false && file.type.startsWith('image/')) {
        uploadFile = await optimizeImage(file);
      }

      // Create uploader with multiple servers for redundancy
      const uploader = new BlossomUploader({
        servers: BLOSSOM_SERVERS,
        signer: user.signer,
      });

      try {
        const tags = await uploader.upload(uploadFile);
        return tags;
      } catch (error) {
        // Provide more helpful error messages
        if (error instanceof Error) {
          if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            throw new Error('Authorization failed. Please ensure you are signed in.');
          }
          if (error.message.includes('413') || error.message.includes('Too Large')) {
            throw new Error('File is too large for the server.');
          }
          if (error.message.includes('415') || error.message.includes('Unsupported')) {
            throw new Error('File type is not supported.');
          }
          throw error;
        }
        throw new Error('Upload failed');
      }
    },
  });
}