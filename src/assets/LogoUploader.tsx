import React, { useState, ChangeEvent, FormEvent } from 'react';

const LogoUploader: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      // Basic validation for file type and size
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('File size should not exceed 5MB.');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setUploadMessage(null);

      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !preview) {
      setError('Please select a file and wait for the preview to appear.');
      return;
    }

    setIsUploading(true);

    try {
      // Instead of uploading, we save the Base64 data URL to localStorage.
      localStorage.setItem('pc_app_logo', preview);
      setUploadMessage('Logo saved successfully! It will now appear in the header and on the login page.');
      setError(null);
      // We can trigger a custom event to notify other components (like the header) to update the logo.
      window.dispatchEvent(new Event('logo-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save logo to local storage.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <h3>Upload New Logo</h3>
      <form onSubmit={handleUpload}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {preview && (
          <div>
            <h4>Preview:</h4>
            <img src={preview} alt="Logo preview" style={{ width: '150px', height: 'auto', border: '1px solid #ddd', padding: '5px' }} />
          </div>
        )}
        <button type="submit" disabled={!selectedFile || isUploading}>
          {isUploading ? 'Uploading...' : 'Upload Logo'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {uploadMessage && <p style={{ color: 'green' }}>{uploadMessage}</p>}
    </div>
  );
};

export default LogoUploader;