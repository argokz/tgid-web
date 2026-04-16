const geoserverUrl = 'https://itwin.kz/geoserver';
const authHeaders = { 'Authorization': `Basic ${Buffer.from('admin:geoserver').toString('base64')}`, 'Accept': 'application/json' };

async function test() {
  console.log("Fetching uzel.json...");
  try {
    const res = await fetch(`${geoserverUrl}/rest/workspaces/AlmatyGIS/layers/uzel.json`, { headers: authHeaders, signal: AbortSignal.timeout(5000) });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Style name:", data?.layer?.defaultStyle?.name);

    if (data?.layer?.defaultStyle?.name) {
      const rawName = data.layer.defaultStyle.name;
      const cleanStyleName = rawName.includes(':') ? rawName.split(':')[1] : rawName;
      
      console.log("Fetching MBStyle...", cleanStyleName);
      const styleRes = await fetch(`${geoserverUrl}/rest/workspaces/AlmatyGIS/styles/${cleanStyleName}.json`, { 
        headers: { ...authHeaders, 'Accept': 'application/vnd.mapbox.style+json' },
        signal: AbortSignal.timeout(5000)
      });
      console.log("MBStyle status:", styleRes.status);
      const styleData = await styleRes.json().catch(()=>null);
      console.log("MBStyle keys:", Object.keys(styleData || {}));
      console.log("MBStyle layers count:", styleData?.layers?.length);
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
test();
