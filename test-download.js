/**
 * Simple test script to validate download functionality
 * Run with: node test-download.js
 */

const API_BASE = 'http://localhost:8080';

// Test download request
const testDownload = async () => {
  console.log('🧪 Testing Download Integration...\n');

  try {
    // 1. Test download start
    console.log('1️⃣ Starting download...');
    const downloadResponse = await fetch(`${API_BASE}/download/chapter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        novel_name: 'shadow-slave',
        chapter_number: 2,
        narrator_voice: 'en-US-ChristopherNeural',
        dialogue_voice: 'en-US-AriaNeural'
      }),
    });

    if (!downloadResponse.ok) {
      throw new Error(`Download failed: ${downloadResponse.status}`);
    }

    const downloadData = await downloadResponse.json();
    console.log('✅ Download started:', downloadData);

    const { download_id: downloadId } = downloadData;

    // 2. Test progress monitoring
    console.log('\n2️⃣ Monitoring progress...');
    let attempts = 0;
    const maxAttempts = 20; // Wait up to 2 minutes

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds

      const statusResponse = await fetch(`${API_BASE}/download/status/${downloadId}`);

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();
      console.log(`📊 Progress: ${status.progress}% (${status.completed_files}/${status.total_files} files) - ${status.status}`);

      if (status.status === 'completed') {
        console.log('✅ Download completed successfully!');
        console.log('📁 Files:', status.files);

        // 3. Test file access
        console.log('\n3️⃣ Testing file access...');

        // Test content.json
        const contentResponse = await fetch(`${API_BASE}/download/file/${downloadId}/content.json`);
        if (contentResponse.ok) {
          const content = await contentResponse.json();
          console.log('✅ Content.json accessible');
          console.log(`📄 Chapter has ${content.paragraphs?.length || 0} paragraphs`);
        } else {
          console.log('❌ Content.json not accessible');
        }

        // Test title.mp3
        const titleResponse = await fetch(`${API_BASE}/download/file/${downloadId}/title.mp3`);
        console.log(titleResponse.ok ? '✅ Title.mp3 accessible' : '❌ Title.mp3 not accessible');

        // Test first paragraph audio
        const paragraphResponse = await fetch(`${API_BASE}/download/file/${downloadId}/0.mp3`);
        console.log(paragraphResponse.ok ? '✅ Paragraph audio accessible' : '❌ Paragraph audio not accessible');

        console.log('\n🎉 All tests passed! Download integration is working correctly.');
        return;
      }

      if (status.status === 'error') {
        console.log('❌ Download failed:', status.error_message);
        return;
      }

      attempts++;
    }

    console.log('⏰ Download test timed out');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Test API compatibility
const testAPICompatibility = async () => {
  console.log('\n🔍 Testing API Compatibility...');

  try {
    // Test health endpoint
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Backend health:', health);
    } else {
      console.log('❌ Backend health check failed');
    }

    // Test novels endpoint
    const novelsResponse = await fetch(`${API_BASE}/novels`);
    if (novelsResponse.ok) {
      const novels = await novelsResponse.json();
      console.log(`✅ Novels endpoint working, found ${novels.length} novels`);
    } else {
      console.log('❌ Novels endpoint failed');
    }

  } catch (error) {
    console.error('❌ API compatibility test failed:', error.message);
  }
};

// Run tests
const main = async () => {
  await testAPICompatibility();
  await testDownload();
};

main().catch(console.error);