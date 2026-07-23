import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fastApiService } from '../../services/fastApiService'

describe('fastApiService topology contracts', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ success: true, id: 10 })
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { mapApiBaseUrl: 'https://api.example.test/' }
    }))
  })

  it('uses the API-prefixed endpoint for line creation', async () => {
    await fastApiService.createLine(4, 9)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/topology/line',
      { method: 'POST', body: { nodeid1: 4, nodeid2: 9 } }
    )
  })

  it('uses the API-prefixed endpoint for line deletion', async () => {
    await fastApiService.deleteLine(17)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/topology/line/17',
      { method: 'DELETE' }
    )
  })

  it('sends coordinates when splitting a line', async () => {
    fetchMock.mockResolvedValue({ status: 'success', new_node_id: 21, new_line_id: 22 })

    const result = await fastApiService.splitLine(17, 76.91, 43.25)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/topology/split-line',
      {
        method: 'POST',
        body: { line_id: 17, lng: 76.91, lat: 43.25 }
      }
    )
    expect(result.new_node_id).toBe(21)
  })

  it('passes desktop defect journal filters through the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 50, pages: 0 })

    await fastApiService.getDefects({
      page: 2,
      source_id: 3,
      state_id: 1,
      line_id: 42,
      date_from: '2025-09-01',
      date_to: '2026-05-31'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/defects',
      {
        query: {
          page: 2,
          source_id: 3,
          state_id: 1,
          line_id: 42,
          date_from: '2025-09-01',
          date_to: '2026-05-31'
        }
      }
    )
  })

  it('uses the defect card and lookup endpoints', async () => {
    await fastApiService.getDefectLookups()
    await fastApiService.getDefect(77)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/defects/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/defects/77')
  })

  it('passes desktop shurf journal filters through the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 3, page_size: 25, pages: 0 })

    await fastApiService.getShurfs({
      page: 3,
      page_size: 25,
      purpose_id: 1,
      state_id: 2,
      approved: false,
      node_id: 51,
      date_from: '2026-01-01'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/shurfs',
      {
        query: {
          page: 3,
          page_size: 25,
          purpose_id: 1,
          state_id: 2,
          approved: false,
          node_id: 51,
          date_from: '2026-01-01'
        }
      }
    )
  })

  it('uses the shurf card and lookup endpoints', async () => {
    await fastApiService.getShurfLookups()
    await fastApiService.getShurf(19)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/shurfs/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/shurfs/19')
  })

  it('passes desktop inspection filters through the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 50, pages: 0 })

    await fastApiService.getInspections({
      page: 2,
      responsible_id: 7,
      has_defects: true,
      has_inspected_sections: false,
      line_id: 44,
      date_from: '2025-09-01',
      date_to: '2026-05-31'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/inspections',
      {
        query: {
          page: 2,
          responsible_id: 7,
          has_defects: true,
          has_inspected_sections: false,
          line_id: 44,
          date_from: '2025-09-01',
          date_to: '2026-05-31'
        }
      }
    )
  })

  it('uses the inspection card and lookup endpoints', async () => {
    await fastApiService.getInspectionLookups()
    await fastApiService.getInspection(23)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/inspections/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/inspections/23')
  })

  it('passes desktop repair journal filters through the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 25, pages: 0 })

    await fastApiService.getRepairs({
      page: 2,
      page_size: 25,
      state_id: 2,
      repair_type_id: 3,
      category_id: 4,
      responsible_id: 7,
      approved: true,
      node_id: 51,
      date_from: '2026-01-01',
      date_to: '2026-12-31'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/repairs',
      {
        query: {
          page: 2,
          page_size: 25,
          state_id: 2,
          repair_type_id: 3,
          category_id: 4,
          responsible_id: 7,
          approved: true,
          node_id: 51,
          date_from: '2026-01-01',
          date_to: '2026-12-31'
        }
      }
    )
  })

  it('uses the repair card and lookup endpoints', async () => {
    await fastApiService.getRepairLookups()
    await fastApiService.getRepair(31)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/repairs/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/repairs/31')
  })

  it('passes desktop pressure test filters through the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 25, pages: 0 })

    await fastApiService.getPressureTests({
      page: 2,
      page_size: 25,
      state_id: 1,
      test_type_id: 4,
      heat_source_id: 9,
      responsible_id: 7,
      approved: false,
      line_id: 42,
      date_from: '2026-01-01',
      date_to: '2026-12-31'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/pressure-tests',
      {
        query: {
          page: 2,
          page_size: 25,
          state_id: 1,
          test_type_id: 4,
          heat_source_id: 9,
          responsible_id: 7,
          approved: false,
          line_id: 42,
          date_from: '2026-01-01',
          date_to: '2026-12-31'
        }
      }
    )
  })

  it('uses the pressure test card and lookup endpoints', async () => {
    await fastApiService.getPressureTestLookups()
    await fastApiService.getPressureTest(41)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/pressure-tests/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/pressure-tests/41')
  })

  it('passes desktop technical condition filters through the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 25, pages: 0 })

    await fastApiService.getTechnicalConditions({
      page: 2,
      page_size: 25,
      state_id: 1,
      issue_year: 2025,
      heat_source: 'ТЭЦ-2',
      district: 'Район 1',
      linked: true,
      building_id: 24126,
      date_from: '2025-01-01',
      date_to: '2025-12-31'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/technical-conditions',
      {
        query: {
          page: 2,
          page_size: 25,
          state_id: 1,
          issue_year: 2025,
          heat_source: 'ТЭЦ-2',
          district: 'Район 1',
          linked: true,
          building_id: 24126,
          date_from: '2025-01-01',
          date_to: '2025-12-31'
        }
      }
    )
  })

  it('uses the technical condition card and lookup endpoints', async () => {
    await fastApiService.getTechnicalConditionLookups()
    await fastApiService.getTechnicalCondition(12711)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/technical-conditions/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/technical-conditions/12711')
  })

  it('passes desktop corrosion indicator filters through the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 25, pages: 0 })

    await fastApiService.getCorrosionIndicators({
      page: 2,
      page_size: 25,
      phase_id: 2,
      rod_state_id: 1,
      process_mark_id: 3,
      water_aggressiveness_id: 2,
      season_year: 2025,
      line_id: 42,
      date_from: '2025-09-01',
      date_to: '2026-05-31'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/corrosion-indicators',
      {
        query: {
          page: 2,
          page_size: 25,
          phase_id: 2,
          rod_state_id: 1,
          process_mark_id: 3,
          water_aggressiveness_id: 2,
          season_year: 2025,
          line_id: 42,
          date_from: '2025-09-01',
          date_to: '2026-05-31'
        }
      }
    )
  })

  it('uses the corrosion indicator card and lookup endpoints', async () => {
    await fastApiService.getCorrosionIndicatorLookups()
    await fastApiService.getCorrosionIndicator(73)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/corrosion-indicators/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/corrosion-indicators/73')
  })

  it('passes ALSEKO reconciliation filters through the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 25, pages: 0 })

    await fastApiService.getAlsekoLoads({
      page: 2,
      page_size: 25,
      match_status: 'unmatched',
      customer_group: 'apartment',
      operation_district: 'ВЭР',
      administrative_district: 'Алмалинский',
      heat_source: 'ТЭЦ-1',
      temperature_graph: '132-70',
      search: 'Абая'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/alseko/loads',
      { query: {
        page: 2,
        page_size: 25,
        match_status: 'unmatched',
        customer_group: 'apartment',
        operation_district: 'ВЭР',
        administrative_district: 'Алмалинский',
        heat_source: 'ТЭЦ-1',
        temperature_graph: '132-70',
        search: 'Абая'
      } }
    )
  })

  it('uses the ALSEKO lookup, load and building card endpoints', async () => {
    await fastApiService.getAlsekoLookups()
    await fastApiService.getAlsekoLoad(17)
    await fastApiService.getAlsekoBuilding(29)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/alseko/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/alseko/loads/17')
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/alseko/buildings/29')
  })

  it('uses the ALSEKO unassigned-building report endpoint', async () => {
    await fastApiService.getUnassignedAlsekoBuildings({ page: 3, page_size: 50, search: 'Сейфуллина' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/alseko/buildings/unassigned',
      { query: { page: 3, page_size: 50, search: 'Сейфуллина' } }
    )
  })

  it('passes electrical network inventory filters to the read-only API', async () => {
    fetchMock.mockResolvedValue({ items: [], total: 0, page: 2, page_size: 25, pages: 0 })

    await fastApiService.getElectricalObjects({
      page: 2,
      page_size: 25,
      object_type: 'line',
      owner_id: 7,
      parent_line_id: 42,
      voltage_kv: 10,
      search: 'фидер'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/electrical-network/objects',
      { query: { page: 2, page_size: 25, object_type: 'line', owner_id: 7, parent_line_id: 42, voltage_kv: 10, search: 'фидер' } }
    )
  })

  it('uses the electrical network lookup and typed card endpoints', async () => {
    await fastApiService.getElectricalNetworkLookups()
    await fastApiService.getElectricalObject('receiver', 19)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/electrical-network/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/electrical-network/objects/receiver/19')
  })

  it('passes heat-loss season and source filters to the read-only API', async () => {
    await fastApiService.getHeatLossSeasons({ page: 2, page_size: 25, city: 'Алматы', search: '2025' })
    await fastApiService.getHeatLossSources({ page: 3, page_size: 50, fragment_id: 41, readiness: 'ready', search: 'ТЭЦ' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/heat-losses/seasons',
      { query: { page: 2, page_size: 25, city: 'Алматы', search: '2025' } }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/heat-losses/sources',
      { query: { page: 3, page_size: 50, fragment_id: 41, readiness: 'ready', search: 'ТЭЦ' } }
    )
  })

  it('uses heat-loss lookup and typed card endpoints', async () => {
    await fastApiService.getHeatLossLookups()
    await fastApiService.getHeatLossSeason(3)
    await fastApiService.getHeatLossSource(48)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/heat-losses/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/heat-losses/seasons/3')
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/heat-losses/sources/48')
  })

  it('passes consumer-load diagnostic filters to the read-only API', async () => {
    await fastApiService.getConsumerLoadDiagnostics({
      page: 2,
      page_size: 25,
      diagnostic: 'zero_load',
      consumer_type: 'generalized',
      fragment_id: 41,
      state_id: 1,
      search: 'узел 10'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/consumer-load-diagnostics/consumers',
      { query: { page: 2, page_size: 25, diagnostic: 'zero_load', consumer_type: 'generalized', fragment_id: 41, state_id: 1, search: 'узел 10' } }
    )
  })

  it('uses consumer-load lookup and typed card endpoints', async () => {
    await fastApiService.getConsumerLoadLookups()
    await fastApiService.getConsumerLoadDiagnostic('real', 19)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/consumer-load-diagnostics/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/consumer-load-diagnostics/consumers/real/19')
  })

  it('passes temperature-graph source filters to the read-only API', async () => {
    await fastApiService.getTemperatureGraphSources({
      page: 2,
      page_size: 25,
      graph_status: 'duplicates',
      summer_status: 'missing',
      graph_type_id: 1,
      fragment_id: 41,
      search: 'ТЭЦ'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/temperature-graphs/sources',
      { query: { page: 2, page_size: 25, graph_status: 'duplicates', summer_status: 'missing', graph_type_id: 1, fragment_id: 41, search: 'ТЭЦ' } }
    )
  })

  it('uses temperature-graph lookup and source card endpoints', async () => {
    await fastApiService.getTemperatureGraphLookups()
    await fastApiService.getTemperatureGraphSource(193)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/temperature-graphs/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/temperature-graphs/sources/193')
  })

  it('passes installed-pump and catalog filters to the read-only API', async () => {
    await fastApiService.getInstalledPumps({
      page: 2, page_size: 25, configuration_status: 'missing_model',
      fragment_id: 41, state_id: 1, line_id: 77, search: 'НС №7'
    })
    await fastApiService.getPumpCatalog({
      page: 3, page_size: 50, quality_status: 'non_monotonic',
      pump_type: 'СЭ2500-60', search: 'насос'
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/pump-equipment/pumps',
      { query: { page: 2, page_size: 25, configuration_status: 'missing_model', fragment_id: 41, state_id: 1, line_id: 77, search: 'НС №7' } }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/pump-equipment/catalog',
      { query: { page: 3, page_size: 50, quality_status: 'non_monotonic', pump_type: 'СЭ2500-60', search: 'насос' } }
    )
  })

  it('uses pump-equipment lookup and both typed card endpoints', async () => {
    await fastApiService.getPumpEquipmentLookups()
    await fastApiService.getInstalledPump(217)
    await fastApiService.getStandardPump(25)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/pump-equipment/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/pump-equipment/pumps/217')
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/pump-equipment/catalog/25')
  })

  it('passes network-armature filters to the read-only API', async () => {
    await fastApiService.getNetworkArmatures({
      page: 2, page_size: 25, equipment_type: 'damper', quality_status: 'purpose_unknown',
      state_id: 1, fragment_id: 74, purpose: 'Вход ТП', line_id: 2159, search: 'задвижка'
    })
    await fastApiService.getStandardDampers({ page: 1, page_size: 20, search: '30ч47бр' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/network-armatures/items',
      { query: { page: 2, page_size: 25, equipment_type: 'damper', quality_status: 'purpose_unknown', state_id: 1, fragment_id: 74, purpose: 'Вход ТП', line_id: 2159, search: 'задвижка' } }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/network-armatures/catalog',
      { query: { page: 1, page_size: 20, search: '30ч47бр' } }
    )
  })

  it('uses network-armature lookup and typed card endpoints', async () => {
    await fastApiService.getNetworkArmatureLookups()
    await fastApiService.getNetworkArmature('damper', 21)
    await fastApiService.getStandardDamper(1)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/network-armatures/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/network-armatures/items/damper/21')
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/network-armatures/catalog/1')
  })

  it('passes network-regulator filters to inventory and catalog APIs', async () => {
    await fastApiService.getNetworkRegulators({
      page: 3, page_size: 25, regulator_type: 'pressure', quality_status: 'control_node_missing',
      state_id: 1, fragment_id: 74, work_attribute_id: 1, line_id: 64, search: 'регулятор'
    })
    await fastApiService.getRegulatorCatalog({
      page: 2, page_size: 20, catalog_type: 'differential', quality_status: 'ready', search: 'Danfoss'
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/network-regulators/items',
      { query: { page: 3, page_size: 25, regulator_type: 'pressure', quality_status: 'control_node_missing', state_id: 1, fragment_id: 74, work_attribute_id: 1, line_id: 64, search: 'регулятор' } }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/network-regulators/catalog',
      { query: { page: 2, page_size: 20, catalog_type: 'differential', quality_status: 'ready', search: 'Danfoss' } }
    )
  })

  it('uses network-regulator lookup and typed card endpoints', async () => {
    await fastApiService.getNetworkRegulatorLookups()
    await fastApiService.getNetworkRegulator('pressure', 1)
    await fastApiService.getRegulatorCatalogItem('differential', 1)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/network-regulators/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/network-regulators/items/pressure/1')
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/network-regulators/catalog/differential/1')
  })

  it('passes network-bypass filters to inventory and tube APIs', async () => {
    await fastApiService.getNetworkBypasses({
      page: 2, page_size: 25, quality_status: 'connection_node_missing', state_id: 1,
      pipeline_sign_id: 2, fragment_id: 74, line_id: 321695, search: 'байпас'
    })
    await fastApiService.getStandardTubes({
      page: 3, page_size: 20, standard: 'ППУ', quality_status: 'ready', search: 'DN 100'
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/network-bypasses/items',
      { query: { page: 2, page_size: 25, quality_status: 'connection_node_missing', state_id: 1, pipeline_sign_id: 2, fragment_id: 74, line_id: 321695, search: 'байпас' } }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/network-bypasses/tubes',
      { query: { page: 3, page_size: 20, standard: 'ППУ', quality_status: 'ready', search: 'DN 100' } }
    )
  })

  it('uses network-bypass lookup and both card endpoints', async () => {
    await fastApiService.getNetworkBypassLookups()
    await fastApiService.getNetworkBypass(17)
    await fastApiService.getStandardTube(64)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/network-bypasses/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/network-bypasses/items/17')
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/network-bypasses/tubes/64')
  })

  it('passes network-diaphragm filters to the journal API', async () => {
    await fastApiService.getNetworkDiaphragms({
      page: 4, page_size: 25, quality_status: 'topology_missing',
      diameter_mode: 'pending_calculation', state_id: 1, external_sign_line_id: 2,
      fragment_id: 74, line_id: 185900, installation_place: 'Отопление', search: '19657'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/network-diaphragms/items',
      { query: {
        page: 4, page_size: 25, quality_status: 'topology_missing',
        diameter_mode: 'pending_calculation', state_id: 1, external_sign_line_id: 2,
        fragment_id: 74, line_id: 185900, installation_place: 'Отопление', search: '19657'
      } }
    )
  })

  it('uses network-diaphragm lookup and card endpoints', async () => {
    await fastApiService.getNetworkDiaphragmLookups()
    await fastApiService.getNetworkDiaphragm(19657)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/network-diaphragms/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/network-diaphragms/items/19657')
  })

  it('uses elevator journal, lookup, and card endpoints', async () => {
    await fastApiService.getElevators({
      page: 2, page_size: 25, quality_status: 'pending_calculation',
      state_id: 1, fragment_id: 74, line_id: 185900, node_id: 812, search: 'ЭЛ-1'
    })
    await fastApiService.getElevatorLookups()
    await fastApiService.getElevator(42)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/elevators',
      { query: {
        page: 2, page_size: 25, quality_status: 'pending_calculation',
        state_id: 1, fragment_id: 74, line_id: 185900, node_id: 812, search: 'ЭЛ-1'
      } }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/elevators/lookups')
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/elevators/42')
  })
})
