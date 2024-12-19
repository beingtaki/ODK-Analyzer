const zipFileInput = document.getElementById('zipFileInput');
const tableContainer = document.getElementById('tableContainer');
const summaryContainer = document.getElementById('summaryContainer');
const downloadReportButton = document.getElementById('downloadReportButton');
const dateInput = document.getElementById('dateInput');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const logContainer = document.getElementById('logContainer');

let allExtractedData = [];
let selectedDate = null;

// Initialize flatpickr
const fp = flatpickr(dateInput, {
    dateFormat: "Y-m-d",
    onClose: function(selectedDates, dateStr, instance) {
        handleDateChange(dateStr)
    }
});

// Set initial date to today
const today = new Date();
dateInput.value = formatDate(today);
selectedDate = formatDate(today);


// Event listeners for buttons
prevBtn.addEventListener('click', () => {
    changeDate(-1);
});

nextBtn.addEventListener('click', () => {
     changeDate(1);
});

// Function to change date
function changeDate(days) {
    const currentDate = new Date(dateInput.value);
    currentDate.setDate(currentDate.getDate() + days);
    const formattedDate = formatDate(currentDate)
    dateInput.value = formattedDate;
     handleDateChange(formattedDate);
}

// Function to format date to YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function handleDateChange(newDate) {
   selectedDate = newDate;
   updateDisplay();
}

zipFileInput.addEventListener('change', handleFileSelect);
downloadReportButton.addEventListener('click', downloadCSV);
zipFileInput.labels[0].innerText = "Upload Instances";


async function updateDisplay(){
    downloadReportButton.disabled = true;
    tableContainer.innerHTML = "";
    summaryContainer.innerHTML = "";


     if (allExtractedData && allExtractedData.length > 0) {
         let xmlData = filterByDate(allExtractedData, selectedDate);
         xmlData = removeDuplicateHHIDs(xmlData);
         displaySummaryTable(xmlData);
         displayDataInTable(xmlData);
       downloadReportButton.disabled = false;
      }

}

async function handleFileSelect(event) {
    const file = event.target.files[0];
     logMessage("File selected: " + file.name, false);

    if (!file) {
        return;
    }
    downloadReportButton.disabled = true;
    selectedDate = null;
      dateInput.value = formatDate(new Date());
      handleDateChange(formatDate(new Date()));

    try {
        logMessage("Loading zip file...", false);
        const zip = await JSZip.loadAsync(file);
          logMessage("Starting XML extraction and parsing...",false);
        allExtractedData = await extractAndParseXML(zip);
          logContainer.innerHTML = '';
        let xmlData = filterByDate(allExtractedData,selectedDate);
        xmlData = removeDuplicateHHIDs(xmlData);
        displaySummaryTable(xmlData);
        displayDataInTable(xmlData);
         downloadReportButton.disabled = false;

        const latestDate = findLatestDate(allExtractedData)
        if(latestDate) {
            dateInput.value = latestDate;
          handleDateChange(latestDate);
          }



    } catch (error) {
       logMessage("Error processing file: " + error, true);
        tableContainer.innerHTML = "<p>Error processing the zip file.</p>";
        summaryContainer.innerHTML = "";
        downloadReportButton.disabled = true;
    }
}
   function findLatestDate(xmlData) {


    if (!xmlData || xmlData.length === 0) {
        return null;
    }

    let latestDate = xmlData[0].today;
      for(const entry of xmlData){
        if(entry.today > latestDate){
          latestDate = entry.today;
        }
    }
     return latestDate;
}


  async function extractAndParseXML(zip) {
    const xmlData = [];

    for (const relativePath in zip.files) {
        if (relativePath.endsWith('.xml')) {
             logMessage("Processing XML file: " + relativePath, false, true);

           const xmlFile = zip.files[relativePath];
           const xmlString = await xmlFile.async('string');
           const parser = new DOMParser();
           const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            const extractedData = extractRelevantData(xmlDoc);
            if(extractedData) {
                xmlData.push(extractedData);
            }
            logMessage("XML file processed: " + relativePath, false, true)
        }
    }
   return xmlData;
}


 function extractRelevantData(xmlDoc) {
    const confirmationElement = xmlDoc.querySelector('confirmation');
    const todayElement = xmlDoc.querySelector('today');
     const deviceidElement = xmlDoc.querySelector('deviceid');
      if (!confirmationElement || !todayElement || !deviceidElement) {
        return null;
    }

    const data = {};
    for (const child of confirmationElement.children) {
       data[child.tagName] = child.textContent;
   }


   return {
       confirm_progres: data.confirm_progres,
       today: todayElement.textContent,
       confirm_gender: data.confirm_gender,
       confirm_role: data.confirm_role,
       deviceid: deviceidElement.textContent
   };
}


function filterByDate(xmlData, selectedDate) {

    if (!xmlData || xmlData.length === 0) {
         return [];
   }
     let latestDate = findLatestDate(xmlData);
    const formattedSelectedDate = selectedDate ? formatDate(new Date(selectedDate)) : null;

  if(formattedSelectedDate){
       return xmlData.filter(entry => entry.today === formattedSelectedDate);
     }else{
         return xmlData.filter(entry => entry.today === latestDate);
     }
 }



  function removeDuplicateHHIDs(xmlData) {

        if (!xmlData || xmlData.length === 0) {
            return [];
        }

        xmlData.sort((a,b) => a.confirm_progres.localeCompare(b.confirm_progres, undefined, { sensitivity: 'base' }));


        const uniqueEntries = [];
        const seenHHIds = new Set();

         for (const entry of xmlData) {
                const hhId = entry.confirm_progres.toLowerCase();
                 if(!seenHHIds.has(hhId)){
                    uniqueEntries.push(entry);
                     seenHHIds.add(hhId);
                }
         }

        return uniqueEntries;

}
  function displaySummaryTable(xmlData) {

    if (!xmlData || xmlData.length === 0) {
        summaryContainer.innerHTML = "<p>No data found to display summary.</p>";
        return;
    }

     const totalCount = xmlData.length;


    const genderCounts = {};
    const roleCounts = {};

    xmlData.forEach(item => {
        const gender = item.confirm_gender.toLowerCase();
        genderCounts[gender] = (genderCounts[gender] || 0) + 1;

        const role = item.confirm_role.toLowerCase();
        roleCounts[role] = (roleCounts[role] || 0) + 1;
    });



     const summaryTable = document.createElement('table');
     summaryTable.id = "summaryTable";
    let headerRow = document.createElement('tr');
    let th = document.createElement('th');
     th.textContent = "Summary";
     th.setAttribute("colspan", 2);
    headerRow.appendChild(th);
    summaryTable.appendChild(headerRow)



     let row = document.createElement('tr');
     let cell1 = document.createElement('td');
     cell1.textContent = "Total Count";
      row.appendChild(cell1)


     let cell2 = document.createElement('td');
     cell2.textContent = totalCount;
      row.appendChild(cell2)
      summaryTable.appendChild(row)


     row = document.createElement('tr');
     cell1 = document.createElement('td');
     cell1.textContent = "Gender Counts";
      row.appendChild(cell1)

      cell2 = document.createElement('td');
        let genderText = "";
         for (const gender in genderCounts) {
          genderText += `${gender} : ${genderCounts[gender]}, `;
          }

       cell2.textContent = genderText;
       row.appendChild(cell2);
        summaryTable.appendChild(row);



     row = document.createElement('tr');
    cell1 = document.createElement('td');
    cell1.textContent = "Role Counts";
    row.appendChild(cell1)


    cell2 = document.createElement('td');
     let roleText = "";
        for (const role in roleCounts) {
             roleText += `${role} : ${roleCounts[role]}, `;
            }

    cell2.textContent = roleText;
    row.appendChild(cell2);
        summaryTable.appendChild(row);



    summaryContainer.innerHTML = "";
    summaryContainer.appendChild(summaryTable);
}

function displayDataInTable(xmlData) {
    if (!xmlData || xmlData.length === 0) {
        tableContainer.innerHTML = "<p>No matching data found within the zip file.</p>";
        return;
    }

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    const headers = ["SL", "HH ID", "Date", "Gender", "Role"];

    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    xmlData.forEach((item, index) => {
        const row = document.createElement('tr');

        const slCell = document.createElement('td');
        slCell.textContent = index + 1;
        row.appendChild(slCell);

        const hhIdCell = document.createElement('td');
        hhIdCell.textContent = item.confirm_progres.toUpperCase() || '';
        row.appendChild(hhIdCell);

        const dateCell = document.createElement('td');
        dateCell.textContent = item.today || '';
        row.appendChild(dateCell);

        const genderCell = document.createElement('td');
         genderCell.textContent = item.confirm_gender.toLowerCase() || '';
        row.appendChild(genderCell);


        const roleCell = document.createElement('td');
        roleCell.textContent = item.confirm_role.toLowerCase() || '';
        row.appendChild(roleCell);

        table.appendChild(row);
    });

    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
}

 function downloadCSV() {

    if (!allExtractedData || allExtractedData.length === 0) {
         alert("No data to download");
        return;
    }
   const filteredData = filterByDate(allExtractedData, selectedDate);
    const uniqueData = removeDuplicateHHIDs(filteredData);



    const firstEntry = uniqueData[0];

     const deviceId = firstEntry.deviceid.replace(/:/g, '-');
     let  latestDate = firstEntry.today;

   if(selectedDate){
      latestDate = selectedDate
    }


    const fileName = `${latestDate}-${deviceId}.csv`;


    const headers = ["SL", "HH ID", "Date", "Gender", "Role", "Device ID"];
    const csvRows = [];

    csvRows.push(headers.join(","));

   uniqueData.forEach((item, index) => {
        const row = [
            index+1,
            item.confirm_progres || '',
            item.today || '',
            item.confirm_gender || '',
            item.confirm_role || '',
            item.deviceid || ''
            ];
        csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function logMessage(message, persist, temp) {
    if(temp) {
      logContainer.innerHTML = '';
        const logElement = document.createElement('div');
      logElement.textContent = message;
      logContainer.appendChild(logElement);
   } else if (persist){
    const logElement = document.createElement('div');
      logElement.textContent = message;
      logContainer.appendChild(logElement);
    }
    else{
        logContainer.innerHTML = "";
        const logElement = document.createElement('div');
        logElement.textContent = message;
        logContainer.appendChild(logElement);
        const logElement2 = document.createElement('div');
         logContainer.appendChild(logElement2);

    }

}