function doPost(e) {
  try {
    const sheet = SpreadsheetApp
      .openByUrl("https://docs.google.com/spreadsheets/d/1AosuOc7fCAh-zHh4-EVfa7BcAbzbIr75JV6gaJdHxzo/edit")
      .getSheetByName("Sheet1");
    
    // ✅ Parse JSON body
    const params = JSON.parse(e.postData.contents);
    let fileUrl = "";
    
    // ✅ Handle file upload from base64
    if (params.fileData && params.fileName) {
      try {
        // Get or create folder by name
        const folders = DriveApp.getFoldersByName("CLT_ASSAIGNMENTS");
        let folder;
        
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          // Create folder if it doesn't exist
          folder = DriveApp.createFolder("CLT_ASSAIGNMENTS");
        }
        
        // Decode base64 and create file
        const blob = Utilities.newBlob(
          Utilities.base64Decode(params.fileData),
          params.mimeType || 'application/octet-stream',
          `${params.name || "assignment"}_${Date.now()}_${params.fileName}`
        );
        
        const file = folder.createFile(blob);
        fileUrl = file.getUrl();
        
        Logger.log("File uploaded: " + fileUrl);
      } catch (fileError) {
        Logger.log("File upload error: " + fileError);
      }
    }
    
    // ✅ Append row to Google Sheet
    sheet.appendRow([
      params.name || "",
      params.email || "",
      params.mobile || "",
      params.classDate || "",
      params.classAttended || "",
      params.mentor || "",
      params.classFeedback || "",
      params.offlineAvailability || "",
      fileUrl,
      new Date(),
    ]);
    
    return ContentService
      .createTextOutput(
        JSON.stringify({ status: "success", message: "Added successfully", fileUrl: fileUrl })
      )
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log("Error: " + error);
    return ContentService
      .createTextOutput(
        JSON.stringify({ status: "error", message: error.toString() })
      )
      .setMimeType(ContentService.MimeType.JSON);
  }
}