/**
 * Delta Institutions — Student Enrollment Form
 * Google Apps Script (Web App)
 *
 * Sheet columns:
 *   A  Full Name          B  Email              C  Phone/WhatsApp
 *   D  Emergency Contact  E  Gender             F  Date of Birth
 *   G  Nationality        H  Home Country       I  Occupation
 *   J  Emirates ID        K  Country Attendance L  Permanent Address
 *   M  Residency UAE      N  Experience Level   O  Preferred Start Date
 *   P  How Heard          Q  Courses Selected   R  Payment Method
 *   S  Terms Agreed       T  Submitted At
 *   U  Passport File      V  Photo File
 *
 * Deploy as Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 */

function doPost(e) {
  try {
    // ── 1. Open sheet ────────────────────────────────────────────────────────
    const sheet = SpreadsheetApp
      .openByUrl("https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit")
      .getSheetByName("Sheet1");

    // ── 2. Parse payload ─────────────────────────────────────────────────────
    const params = JSON.parse(e.postData.contents);

    // ── 3. Get / create Drive folder ─────────────────────────────────────────
    const folders = DriveApp.getFoldersByName("DELTA_ENROLLMENTS");
    const folder = folders.hasNext()
      ? folders.next()
      : DriveApp.createFolder("DELTA_ENROLLMENTS");

    // ── 4. Upload files ───────────────────────────────────────────────────────
    const fileUrls = { passport: "", photo: "" };

    const uploadFile = (fileData, label) => {
      if (!fileData || !fileData.data || !fileData.name) return "";
      try {
        const safeName = `${params.fullName || "student"}_${label}_${Date.now()}_${fileData.name}`;
        const blob = Utilities.newBlob(
          Utilities.base64Decode(fileData.data),
          fileData.mimeType || "application/octet-stream",
          safeName
        );
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return file.getUrl();
      } catch (err) {
        Logger.log(`Upload error (${label}): ${err}`);
        return "";
      }
    };

    fileUrls.passport = uploadFile(params.passportFile, "passport");
    fileUrls.photo    = uploadFile(params.photoFile,    "photo");

    // ── 5. Append row ─────────────────────────────────────────────────────────
    const lastRow = sheet.getLastRow() + 1;

    sheet.appendRow([
      params.fullName          || "",   // A
      params.email             || "",   // B
      params.phone             || "",   // C
      params.emergency         || "",   // D
      params.gender            || "",   // E
      params.dob               || "",   // F
      params.nationality       || "",   // G
      params.homeCountry       || "",   // H
      params.occupation        || "",   // I
      params.emiratesId        || "",   // J
      params.countryAttendance || "",   // K
      params.permanentAddress  || "",   // L
      params.residencyAddress  || "",   // M
      params.level             || "",   // N
      params.startDate         || "",   // O
      params.source            || "",   // P
      params.courses           || "",   // Q
      params.payment           || "",   // R
      params.termsAgreed       || "No", // S
      new Date(),                       // T
      "",                               // U  (passport link — set below)
      "",                               // V  (photo link    — set below)
    ]);

    // ── 6. Write hyperlinks for files ─────────────────────────────────────────
    const setLink = (col, url, label) => {
      if (!url) return;
      const formula = `=HYPERLINK("${url}","${label}")`;
      sheet.getRange(lastRow, col).setFormula(formula);
      sheet.getRange(lastRow, col)
        .setFontColor("#1155cc")
        .setFontWeight("bold")
        .setHorizontalAlignment("center");
    };

    setLink(21, fileUrls.passport, "Passport"); // column U
    setLink(22, fileUrls.photo,    "Photo");    // column V

    // ── 7. Return success ─────────────────────────────────────────────────────
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "success",
        message: "Enrollment submitted successfully",
        passportUrl: fileUrls.passport,
        photoUrl: fileUrls.photo,
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Enrollment error: " + error);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString(),
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Optional: handle GET for health check */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", form: "Delta Enrollment" }))
    .setMimeType(ContentService.MimeType.JSON);
}
