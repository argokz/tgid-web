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
      expect.objectContaining({ method: 'POST', body: { nodeid1: 4, nodeid2: 9 } })
    )
  })

  it('uses the API-prefixed endpoint for line deletion', async () => {
    await fastApiService.deleteLine(17)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/topology/line/17',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('sends coordinates when splitting a line', async () => {
    fetchMock.mockResolvedValue({ status: 'success', new_node_id: 21, new_line_id: 22 })

    const result = await fastApiService.splitLine(17, 76.91, 43.25)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/topology/split-line',
      expect.objectContaining({
        method: 'POST',
        body: { line_id: 17, lng: 76.91, lat: 43.25 }
      })
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
      expect.objectContaining({
        query: {
          page: 2,
          source_id: 3,
          state_id: 1,
          line_id: 42,
          date_from: '2025-09-01',
          date_to: '2026-05-31'
        }
      })
    )
  })

  it('uses the defect card and lookup endpoints', async () => {
    await fastApiService.getDefectLookups()
    await fastApiService.getDefect(77)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/defects/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/defects/77', expect.anything())
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
      expect.objectContaining({
        query: {
          page: 3,
          page_size: 25,
          purpose_id: 1,
          state_id: 2,
          approved: false,
          node_id: 51,
          date_from: '2026-01-01'
        }
      })
    )
  })

  it('uses the shurf card and lookup endpoints', async () => {
    await fastApiService.getShurfLookups()
    await fastApiService.getShurf(19)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/shurfs/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/shurfs/19', expect.anything())
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
      expect.objectContaining({
        query: {
          page: 2,
          responsible_id: 7,
          has_defects: true,
          has_inspected_sections: false,
          line_id: 44,
          date_from: '2025-09-01',
          date_to: '2026-05-31'
        }
      })
    )
  })

  it('uses the inspection card and lookup endpoints', async () => {
    await fastApiService.getInspectionLookups()
    await fastApiService.getInspection(23)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/inspections/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/inspections/23', expect.anything())
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
      expect.objectContaining({
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
      })
    )
  })

  it('uses the repair card and lookup endpoints', async () => {
    await fastApiService.getRepairLookups()
    await fastApiService.getRepair(31)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/repairs/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/repairs/31', expect.anything())
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
      expect.objectContaining({
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
      })
    )
  })

  it('uses the pressure test card and lookup endpoints', async () => {
    await fastApiService.getPressureTestLookups()
    await fastApiService.getPressureTest(41)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/pressure-tests/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/pressure-tests/41', expect.anything())
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
      expect.objectContaining({
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
      })
    )
  })

  it('uses the technical condition card and lookup endpoints', async () => {
    await fastApiService.getTechnicalConditionLookups()
    await fastApiService.getTechnicalCondition(12711)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/technical-conditions/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/technical-conditions/12711', expect.anything())
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
      expect.objectContaining({
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
      })
    )
  })

  it('uses the corrosion indicator card and lookup endpoints', async () => {
    await fastApiService.getCorrosionIndicatorLookups()
    await fastApiService.getCorrosionIndicator(73)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/corrosion-indicators/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/corrosion-indicators/73', expect.anything())
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
      expect.objectContaining({ query: {
        page: 2,
        page_size: 25,
        match_status: 'unmatched',
        customer_group: 'apartment',
        operation_district: 'ВЭР',
        administrative_district: 'Алмалинский',
        heat_source: 'ТЭЦ-1',
        temperature_graph: '132-70',
        search: 'Абая'
      } })
    )
  })

  it('uses the ALSEKO lookup, load and building card endpoints', async () => {
    await fastApiService.getAlsekoLookups()
    await fastApiService.getAlsekoLoad(17)
    await fastApiService.getAlsekoBuilding(29)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/alseko/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/alseko/loads/17', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/alseko/buildings/29', expect.anything())
  })

  it('uses the ALSEKO unassigned-building report endpoint', async () => {
    await fastApiService.getUnassignedAlsekoBuildings({ page: 3, page_size: 50, search: 'Сейфуллина' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/alseko/buildings/unassigned',
      expect.objectContaining({ query: { page: 3, page_size: 50, search: 'Сейфуллина' } })
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
      expect.objectContaining({ query: { page: 2, page_size: 25, object_type: 'line', owner_id: 7, parent_line_id: 42, voltage_kv: 10, search: 'фидер' } })
    )
  })

  it('uses the electrical network lookup and typed card endpoints', async () => {
    await fastApiService.getElectricalNetworkLookups()
    await fastApiService.getElectricalObject('receiver', 19)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/electrical-network/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/electrical-network/objects/receiver/19', expect.anything())
  })

  it('passes heat-loss season and source filters to the read-only API', async () => {
    await fastApiService.getHeatLossSeasons({ page: 2, page_size: 25, city: 'Алматы', search: '2025' })
    await fastApiService.getHeatLossSources({ page: 3, page_size: 50, fragment_id: 41, readiness: 'ready', search: 'ТЭЦ' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/heat-losses/seasons',
      expect.objectContaining({ query: { page: 2, page_size: 25, city: 'Алматы', search: '2025' } })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/heat-losses/sources',
      expect.objectContaining({ query: { page: 3, page_size: 50, fragment_id: 41, readiness: 'ready', search: 'ТЭЦ' } })
    )
  })

  it('uses heat-loss lookup and typed card endpoints', async () => {
    await fastApiService.getHeatLossLookups()
    await fastApiService.getHeatLossSeason(3)
    await fastApiService.getHeatLossSource(48)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/heat-losses/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/heat-losses/seasons/3', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/heat-losses/sources/48', expect.anything())
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
      expect.objectContaining({ query: { page: 2, page_size: 25, diagnostic: 'zero_load', consumer_type: 'generalized', fragment_id: 41, state_id: 1, search: 'узел 10' } })
    )
  })

  it('uses consumer-load lookup and typed card endpoints', async () => {
    await fastApiService.getConsumerLoadLookups()
    await fastApiService.getConsumerLoadDiagnostic('real', 19)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/consumer-load-diagnostics/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/consumer-load-diagnostics/consumers/real/19', expect.anything())
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
      expect.objectContaining({ query: { page: 2, page_size: 25, graph_status: 'duplicates', summer_status: 'missing', graph_type_id: 1, fragment_id: 41, search: 'ТЭЦ' } })
    )
  })

  it('uses temperature-graph lookup and source card endpoints', async () => {
    await fastApiService.getTemperatureGraphLookups()
    await fastApiService.getTemperatureGraphSource(193)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/temperature-graphs/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/temperature-graphs/sources/193', expect.anything())
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
      expect.objectContaining({ query: { page: 2, page_size: 25, configuration_status: 'missing_model', fragment_id: 41, state_id: 1, line_id: 77, search: 'НС №7' } })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/pump-equipment/catalog',
      expect.objectContaining({ query: { page: 3, page_size: 50, quality_status: 'non_monotonic', pump_type: 'СЭ2500-60', search: 'насос' } })
    )
  })

  it('uses pump-equipment lookup and both typed card endpoints', async () => {
    await fastApiService.getPumpEquipmentLookups()
    await fastApiService.getInstalledPump(217)
    await fastApiService.getStandardPump(25)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/pump-equipment/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/pump-equipment/pumps/217', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/pump-equipment/catalog/25', expect.anything())
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
      expect.objectContaining({ query: { page: 2, page_size: 25, equipment_type: 'damper', quality_status: 'purpose_unknown', state_id: 1, fragment_id: 74, purpose: 'Вход ТП', line_id: 2159, search: 'задвижка' } })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/network-armatures/catalog',
      expect.objectContaining({ query: { page: 1, page_size: 20, search: '30ч47бр' } })
    )
  })

  it('uses network-armature lookup and typed card endpoints', async () => {
    await fastApiService.getNetworkArmatureLookups()
    await fastApiService.getNetworkArmature('damper', 21)
    await fastApiService.getStandardDamper(1)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/network-armatures/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/network-armatures/items/damper/21', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/network-armatures/catalog/1', expect.anything())
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
      expect.objectContaining({ query: { page: 3, page_size: 25, regulator_type: 'pressure', quality_status: 'control_node_missing', state_id: 1, fragment_id: 74, work_attribute_id: 1, line_id: 64, search: 'регулятор' } })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/network-regulators/catalog',
      expect.objectContaining({ query: { page: 2, page_size: 20, catalog_type: 'differential', quality_status: 'ready', search: 'Danfoss' } })
    )
  })

  it('uses network-regulator lookup and typed card endpoints', async () => {
    await fastApiService.getNetworkRegulatorLookups()
    await fastApiService.getNetworkRegulator('pressure', 1)
    await fastApiService.getRegulatorCatalogItem('differential', 1)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/network-regulators/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/network-regulators/items/pressure/1', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/network-regulators/catalog/differential/1', expect.anything())
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
      expect.objectContaining({ query: { page: 2, page_size: 25, quality_status: 'connection_node_missing', state_id: 1, pipeline_sign_id: 2, fragment_id: 74, line_id: 321695, search: 'байпас' } })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/network-bypasses/tubes',
      expect.objectContaining({ query: { page: 3, page_size: 20, standard: 'ППУ', quality_status: 'ready', search: 'DN 100' } })
    )
  })

  it('uses network-bypass lookup and both card endpoints', async () => {
    await fastApiService.getNetworkBypassLookups()
    await fastApiService.getNetworkBypass(17)
    await fastApiService.getStandardTube(64)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/network-bypasses/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/network-bypasses/items/17', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/network-bypasses/tubes/64', expect.anything())
  })

  it('passes network-diaphragm filters to the journal API', async () => {
    await fastApiService.getNetworkDiaphragms({
      page: 4, page_size: 25, quality_status: 'topology_missing',
      diameter_mode: 'pending_calculation', state_id: 1, external_sign_line_id: 2,
      fragment_id: 74, line_id: 185900, installation_place: 'Отопление', search: '19657'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/network-diaphragms/items',
      expect.objectContaining({ query: {
        page: 4, page_size: 25, quality_status: 'topology_missing',
        diameter_mode: 'pending_calculation', state_id: 1, external_sign_line_id: 2,
        fragment_id: 74, line_id: 185900, installation_place: 'Отопление', search: '19657'
      } })
    )
  })

  it('uses network-diaphragm lookup and card endpoints', async () => {
    await fastApiService.getNetworkDiaphragmLookups()
    await fastApiService.getNetworkDiaphragm(19657)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/network-diaphragms/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/network-diaphragms/items/19657', expect.anything())
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
      expect.objectContaining({ query: {
        page: 2, page_size: 25, quality_status: 'pending_calculation',
        state_id: 1, fragment_id: 74, line_id: 185900, node_id: 812, search: 'ЭЛ-1'
      } })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/elevators/lookups', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.example.test/api/elevators/42', expect.anything())
  })

  it('calls simulateValveIsolation with correct payload', async () => {
    fetchMock.mockResolvedValueOnce({
      success: true,
      summary: { valves_count: 3, consumers_count: 5 },
      valves_to_close: [{ id: 1, lineid: 100 }],
      affected_consumers: [{ id: 10, name: 'Дом 1' }],
    })

    const res = await fastApiService.simulateValveIsolation({ line_id: 371424 })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/analysis/valve-isolation',
      expect.objectContaining({
        method: 'POST',
        body: { line_id: 371424 },
      })
    )
    expect(res.success).toBe(true)
    expect(res.summary.valves_count).toBe(3)
  })

  it('calls calculateOrificePlate and calculateElevatorNozzle endpoints', async () => {
    fetchMock.mockResolvedValueOnce({ diameter_orifice_mm: 14.5, flow_g: 10.0, delta_h: 15.0 })
    fetchMock.mockResolvedValueOnce({ mixing_ratio_u: 1.4, nozzle_diameter_mm: 8.2, elevator_number: 3 })

    const resOrifice = await fastApiService.calculateOrificePlate({ flow_g: 10.0, delta_h: 15.0 })
    const resElevator = await fastApiService.calculateElevatorNozzle({ p1: 6.0, p2: 4.0, flow_g: 5.0 })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/calc/orifice-plate',
      expect.objectContaining({ method: 'POST', body: { flow_g: 10.0, delta_h: 15.0 } })
    )
    expect(resOrifice.diameter_orifice_mm).toBe(14.5)

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/calc/elevator-nozzle',
      expect.objectContaining({ method: 'POST', body: { p1: 6.0, p2: 4.0, flow_g: 5.0 } })
    )
    expect(resElevator.elevator_number).toBe(3)
  })

  it('calls downloadThrottlingSheet with correct payload and returns blob', async () => {
    const fakeBlob = new Blob(['fake-excel-data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    fetchMock.mockResolvedValueOnce(fakeBlob)

    const res = await fastApiService.downloadThrottlingSheet({ consumer_name: 'Школа №10', p1: 6.0, p2: 4.0 })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/calc/throttling-sheet',
      expect.objectContaining({
        method: 'POST',
        body: { consumer_name: 'Школа №10', p1: 6.0, p2: 4.0 },
        responseType: 'blob',
      })
    )
    expect(res.blob).toBe(fakeBlob)
    expect(res.filename).toContain('.xlsx')
  })

  it('calls reverseLine, mergeNodes, and updateLineGeometry with correct payloads', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, line_id: 100, nodeid1: 20, nodeid2: 10 })
    fetchMock.mockResolvedValueOnce({ success: true, target_node_id: 1, merged_lines: 3 })
    fetchMock.mockResolvedValueOnce({ success: true, line_id: 100, new_length: 55.4 })

    const resReverse = await fastApiService.reverseLine(100)
    const resMerge = await fastApiService.mergeNodes({ target_node_id: 1, source_node_id: 2 })
    const resGeom = await fastApiService.updateLineGeometry(100, [[76.9, 43.2], [76.91, 43.21]])

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/topology/reverse-line',
      expect.objectContaining({ method: 'POST', body: { line_id: 100 } })
    )
    expect(resReverse.nodeid1).toBe(20)

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/topology/merge-nodes',
      expect.objectContaining({ method: 'POST', body: { target_node_id: 1, source_node_id: 2 } })
    )
    expect(resMerge.merged_lines).toBe(3)

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.example.test/api/topology/line/100/geometry',
      expect.objectContaining({ method: 'PUT', body: { coordinates: [[76.9, 43.2], [76.91, 43.21]] } })
    )
    expect(resGeom.new_length).toBe(55.4)
  })

  it('calls getLatestCalculations and getCalculationResultsGeoJson', async () => {
    fetchMock.mockResolvedValueOnce([{ id: 1, name: 'Расчет 1' }])
    fetchMock.mockResolvedValueOnce({
      type: 'FeatureCollection',
      summary: { lines_count: 5, nodes_count: 6, over_resistance_count: 1, high_velocity_count: 2 },
      features: [],
    })

    const list = await fastApiService.getLatestCalculations(10)
    const geo = await fastApiService.getCalculationResultsGeoJson(1)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/calculations/latest', expect.objectContaining({ query: { limit: 10 } }))
    expect(list).toHaveLength(1)

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/calculations/1/results/geojson', expect.anything())
    expect(geo.summary?.lines_count).toBe(5)
  })

  it('calls downloadPiezometerExcel with waypoints and returns blob', async () => {
    const fakeBlob = new Blob(['fake-piezo-excel'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    fetchMock.mockResolvedValueOnce(fakeBlob)

    const res = await fastApiService.downloadPiezometerExcel([1, 2, 3])

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/piezometer/excel',
      expect.objectContaining({
        method: 'POST',
        body: { waypoints: [1, 2, 3] },
        responseType: 'blob',
      })
    )
    expect(res.blob).toBe(fakeBlob)
    expect(res.filename).toContain('Piezometer_Profile_')
  })
})


describe('fastApiService auth and topology errors', () => {
  const fetchMock = vi.fn()
  const store: Record<string, string> = {}

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ success: true, line_id: 5, nodeid1: 2, nodeid2: 1 })
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { mapApiBaseUrl: 'https://api.example.test/' }
    }))
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    store.itwin_access_token = 'jwt-123'
  })

  it('sends the bearer token with topology writes and compute POSTs', async () => {
    await fastApiService.reverseLine(5)
    await fastApiService.moveNode(7, 76.9, 43.2)
    await fastApiService.buildPiezometerRoute([1, 2])
    await fastApiService.calculateOrificePlate({ flow_g: 5, delta_h: 20 })

    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers).toMatchObject({ Authorization: 'Bearer jwt-123' })
    }
  })

  it('omits the header when there is no token', async () => {
    delete store.itwin_access_token
    await fastApiService.createNode(76.9, 43.2)
    expect(fetchMock.mock.calls[0][1].headers?.Authorization).toBeUndefined()
  })

  it('turns a 409 with blockers into a readable message', async () => {
    fetchMock.mockRejectedValue({
      statusCode: 409,
      data: { detail: { message: 'Узлы нельзя объединить', blockers: { connecting_lines: { 324106: { pressregulators: 1 } } } } },
    })
    await expect(fastApiService.mergeNodes({ target_node_id: 1, source_node_id: 2 }))
      .rejects.toThrow('Узлы нельзя объединить: соединяющие участки с оборудованием — 324106: pressregulators ×1')
  })
})
