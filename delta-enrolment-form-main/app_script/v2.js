function doPost(e) {
  try {
    const sheet = SpreadsheetApp
      .openByUrl("https://docs.google.com/spreadsheets/d/1AosuOc7fCAh-zHh4-EVfa7BcAbzbIr75JV6gaJdHxzo/edit")
      .getSheetByName("Sheet1");
    
    // Parse JSON body
    const params = JSON.parse(e.postData.contents);
    let fileUrls = [];
    
    // Get or create folder
    const folders = DriveApp.getFoldersByName("CLT_ASSAIGNMENTS");
    let folder;
    
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder("CLT_ASSAIGNMENTS");
    }
    
    // Handle multiple files upload
    if (params.files && Array.isArray(params.files) && params.files.length > 0) {
      try {
        // Loop through each file
        params.files.forEach((fileData, index) => {
          if (fileData.data && fileData.name) {
            try {
              // Decode base64 and create file
              const blob = Utilities.newBlob(
                Utilities.base64Decode(fileData.data),
                fileData.mimeType || 'application/octet-stream',
                `${params.name || "assignment"}_${Date.now()}_${index + 1}_${fileData.name}`
              );
              
              const file = folder.createFile(blob);
              fileUrls.push({
                url: file.getUrl(),
                number: index + 1,
                name: fileData.name
              });
              
              Logger.log(`File ${index + 1} uploaded: ${file.getUrl()}`);
            } catch (individualFileError) {
              Logger.log(`Error uploading file ${index + 1}: ${individualFileError}`);
            }
          }
        });
      } catch (filesError) {
        Logger.log("Files upload error: " + filesError);
      }
    }
    // Fallback for single file (backward compatibility)
    else if (params.fileData && params.fileName) {
      try {
        const blob = Utilities.newBlob(
          Utilities.base64Decode(params.fileData),
          params.mimeType || 'application/octet-stream',
          `${params.name || "assignment"}_${Date.now()}_${params.fileName}`
        );
        
        const file = folder.createFile(blob);
        fileUrls.push({
          url: file.getUrl(),
          number: 1,
          name: params.fileName
        });
        
        Logger.log("Single file uploaded: " + file.getUrl());
      } catch (fileError) {
        Logger.log("Single file upload error: " + fileError);
      }
    }
    
    // Get the current row number (where new data will be added)
    const lastRow = sheet.getLastRow() + 1;
    
    // Append row to Google Sheet with placeholder
    sheet.appendRow([
      params.name || "",
      params.email || "",
      params.mobile || "",
      params.classDate || "",
      params.classAttended || "",
      params.mentor || "",
      params.classFeedback || "",
      params.offlineAvailability || "",
      new Date(),
      "", // Placeholder for file links
      
    ]);
    
    // ✅ SOLUTION 1: Use Rich Text with Multiple Links (RECOMMENDED)
    // if (fileUrls.length > 0) {
    //   const richTextBuilder = SpreadsheetApp.newRichTextValue();
    //   let displayText = "";
      
    //   fileUrls.forEach((fileInfo, index) => {
    //     if (index > 0) {
    //       displayText += "; "; // Separator
    //     }
        
    //     const startIndex = displayText.length;
    //     displayText += fileInfo.number.toString();
    //     const endIndex = displayText.length;
        
    //     // Set link for this number
    //     richTextBuilder.setText(displayText);
    //     richTextBuilder.setLinkUrl(startIndex, endIndex, fileInfo.url);
    //   });
      
    //   const richText = richTextBuilder.build();
    //   sheet.getRange(lastRow, 9).setRichTextValue(richText);
      
    //   // Format the cell
    //   sheet.getRange(lastRow, 9)
    //     .setFontColor("#1155cc")
    //     .setFontWeight("bold")
    //     .setHorizontalAlignment("left");
    // }
    
  
    // ✅ ALTERNATIVE SOLUTION 2: Spread Across Multiple Columns
    // Uncomment this if you want each file link in a separate column
    
    if (fileUrls.length > 0) {
      fileUrls.forEach((fileInfo, index) => {
        // Put each link in columns 10, 11, 12, 13, 14 ( J, K, L, M,N)
        const formula = `=HYPERLINK("${fileInfo.url}", "${fileInfo.number}")`;
        sheet.getRange(lastRow, 10 + index).setFormula(formula);
        sheet.getRange(lastRow, 10 + index)
          .setFontColor("#1155cc")
          .setFontWeight("bold")
          .setHorizontalAlignment("center");
      });
    }
    
    
    /* 
    // ✅ ALTERNATIVE SOLUTION 3: Plain Text with Numbers (No Formulas)
    // Uncomment this for simple text links
    
    if (fileUrls.length > 0) {
      const numberedLinks = fileUrls.map((fileInfo, index) => {
        return `${fileInfo.number}. ${fileInfo.url}`;
      }).join("\n");
      
      sheet.getRange(lastRow, 9).setValue(numberedLinks);
      sheet.getRange(lastRow, 9).setWrap(true); // Enable text wrapping
    }
    */
    
    return ContentService
      .createTextOutput(
        JSON.stringify({ 
          status: "success", 
          message: "Added successfully", 
          fileUrls: fileUrls.map(f => f.url),
          fileCount: fileUrls.length
        })
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