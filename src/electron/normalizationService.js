const { v4: uuidv4 } = require("uuid");

// Use the same logging function as excelService
const log = (level, message, ctx) => {
  try {
    const ts = new Date().toISOString();
    const line =
      `${ts} [${level}] ${message}` + (ctx ? " " + JSON.stringify(ctx) : "");
    console.log(line);
  } catch (e) {
    console.error("Logging error:", e);
  }
};

/**
 * Service for normalizing JSON data into collections
 * and recomposing collections back to original JSON format
 */
class NormalizationService {
  constructor() {
    this.collectionStore = require("./collectionStore");
  }

  /**
   * Normalize JSON data into collections
   */
  async normalizeJsonData(jsonData, datasetName = "dataset") {
    try {
      log("INFO", "Starting JSON normalization", { datasetName });

      // Handle array of objects (like Test.json)
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        jsonData = jsonData[0]; // Take first item
      }

      if (!jsonData.data) {
        throw new Error("JSON data must have a 'data' property");
      }

      const data = jsonData.data;
      const collections = {};

      // Normalize pageConfig
      if (data.pageConfig && Array.isArray(data.pageConfig)) {
        collections.pages = await this.normalizePages(data.pageConfig);
        collections.page_elements = await this.normalizePageElements(
          data.pageConfig
        );
      }

      // Normalize testsetConfig
      if (data.testsetConfig && data.testsetConfig.testsets) {
        collections.testsets = await this.normalizeTestsets(
          data.testsetConfig.testsets
        );
        collections.testcases = await this.normalizeTestcases(
          data.testsetConfig.testsets
        );
        collections.steps = await this.normalizeSteps(
          data.testsetConfig.testsets
        );
      }

      // Normalize application
      if (data.application && Array.isArray(data.application)) {
        collections.application = await this.normalizeApplication(
          data.application
        );
      }

      // Save all collections
      for (const [collectionName, rows] of Object.entries(collections)) {
        await this.collectionStore.writeCollection(collectionName, rows);
        log("INFO", "Collection saved", {
          collection: collectionName,
          rows: rows.length,
        });
      }

      log("INFO", "JSON normalization completed", {
        datasetName,
        collections: Object.keys(collections),
        totalRows: Object.values(collections).reduce(
          (sum, rows) => sum + rows.length,
          0
        ),
      });

      return collections;
    } catch (error) {
      log("ERROR", "JSON normalization failed", {
        datasetName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Normalize pages collection
   */
  async normalizePages(pageConfig) {
    return pageConfig.map((page) => ({
      id: page.uuid,
      pageId: page.pageId,
      pageName: page.pageName,
      status: page.status,
      navigationType: page.navigation?.navigationType || "",
      navigationValue: page.navigation?.navigationValue || "",
      _version: 1,
      _created_at: new Date().toISOString(),
      _updated_at: new Date().toISOString(),
    }));
  }

  /**
   * Normalize page elements collection
   */
  async normalizePageElements(pageConfig) {
    const elements = [];

    for (const page of pageConfig) {
      if (page.pageElements && Array.isArray(page.pageElements)) {
        for (const element of page.pageElements) {
          elements.push({
            id: element.uuid,
            pageUuid: page.uuid, // Foreign key to pages
            pageId: element.pageId,
            elementName: element.elementName,
            elementType: element.elementType,
            locatorType: element.locatorType,
            locatorValue: element.locatorValue,
            isPageIdentifier: element.isPageIdentifier === "Yes",
            status: element.status,
            eventName: element.eventName || "",
            _version: 1,
            _created_at: new Date().toISOString(),
            _updated_at: new Date().toISOString(),
          });
        }
      }
    }

    return elements;
  }

  /**
   * Normalize testsets collection
   */
  async normalizeTestsets(testsets) {
    return testsets.map((testset) => ({
      id: testset.uuid,
      legacyId: testset.id,
      name: testset.name,
      status: testset.status,
      appId: testset.appId,
      seqId: testset.seqId,
      _version: 1,
      _created_at: new Date().toISOString(),
      _updated_at: new Date().toISOString(),
    }));
  }

  /**
   * Normalize testcases collection
   */
  async normalizeTestcases(testsets) {
    const testcases = [];

    for (const testset of testsets) {
      if (testset.testCases && Array.isArray(testset.testCases)) {
        for (const testcase of testset.testCases) {
          testcases.push({
            id: testcase.uuid,
            testSetUuid: testset.uuid, // Foreign key to testsets
            testSetId: testcase.testSetId,
            legacyId: testcase.id,
            name: testcase.name,
            status: testcase.status,
            seqId: testcase.seqId,
            _version: 1,
            _created_at: new Date().toISOString(),
            _updated_at: new Date().toISOString(),
          });
        }
      }
    }

    return testcases;
  }

  /**
   * Normalize steps collection
   */
  async normalizeSteps(testsets) {
    const steps = [];

    for (const testset of testsets) {
      if (testset.testCases && Array.isArray(testset.testCases)) {
        for (const testcase of testset.testCases) {
          if (testcase.steps && Array.isArray(testcase.steps)) {
            for (const step of testcase.steps) {
              steps.push({
                id: step.uuid,
                testCaseUuid: testcase.uuid, // Foreign key to testcases
                testCaseId: step.testCaseId,
                legacyId: step.id,
                seqId: step.seqId,
                type: step.type,
                text: step.text,
                testStepGroupName: step.testStepGroupName || "",
                status: step.status,
                _version: 1,
                _created_at: new Date().toISOString(),
                _updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return steps;
  }

  /**
   * Normalize application collection
   */
  async normalizeApplication(application) {
    return application.map((app) => ({
      id: uuidv4(), // Generate new ID since original doesn't have one
      userName: app.USER_NAME,
      userUuid: app.USER_UUID,
      appUuid: app.APP_UUID,
      tenantUuid: app.TENANT_UUID,
      testSuiteUuid: app.TEST_SUITE_UUID,
      versionNumber: app.VERSION_NUMBER,
      _version: 1,
      _created_at: new Date().toISOString(),
      _updated_at: new Date().toISOString(),
    }));
  }

  /**
   * Recompose collections back to original JSON format
   */
  async recomposeJsonData(collections) {
    try {
      log("INFO", "Starting JSON recomposition");

      // Group related data
      const pagesById = new Map(collections.pages?.map((p) => [p.id, p]) || []);
      const elementsByPage = this.groupBy(
        collections.page_elements || [],
        "pageUuid"
      );
      const testsetsById = new Map(
        collections.testsets?.map((ts) => [ts.id, ts]) || []
      );
      const testcasesByTestset = this.groupBy(
        collections.testcases || [],
        "testSetUuid"
      );
      const stepsByTestcase = this.groupBy(
        collections.steps || [],
        "testCaseUuid"
      );

      // Rebuild pageConfig
      const pageConfig =
        collections.pages?.map((page) => ({
          uuid: page.id,
          pageElements: (elementsByPage.get(page.id) || []).map((element) => ({
            pageId: element.pageId,
            elementName: element.elementName,
            elementType: element.elementType,
            locatorType: element.locatorType,
            locatorValue: element.locatorValue,
            isPageIdentifier: element.isPageIdentifier ? "Yes" : "No",
            status: element.status,
            eventName: element.eventName,
            uuid: element.id,
          })),
          status: page.status,
          pageId: page.pageId,
          pageName: page.pageName,
          navigation: {
            navigationType: page.navigationType,
            navigationValue: page.navigationValue,
          },
        })) || [];

      // Rebuild testsetConfig
      const testsets =
        collections.testsets?.map((testset) => ({
          id: testset.legacyId,
          name: testset.name,
          status: testset.status,
          uuid: testset.id,
          appId: testset.appId,
          seqId: testset.seqId,
          testCases: (testcasesByTestset.get(testset.id) || []).map(
            (testcase) => ({
              testSetId: testcase.testSetId,
              id: testcase.legacyId,
              seqId: testcase.seqId,
              name: testcase.name,
              status: testcase.status,
              uuid: testcase.id,
              steps: (stepsByTestcase.get(testcase.id) || []).map((step) => ({
                testCaseId: step.testCaseId,
                seqId: step.seqId,
                type: step.type,
                text: step.text,
                testStepGroupName: step.testStepGroupName,
                status: step.status,
                uuid: step.id,
                tesCaseFunctionSteps: [],
                id: step.legacyId,
              })),
            })
          ),
        })) || [];

      // Rebuild application
      const application =
        collections.application?.map((app) => ({
          USER_NAME: app.userName,
          USER_UUID: app.userUuid,
          APP_UUID: app.appUuid,
          TENANT_UUID: app.tenantUuid,
          TEST_SUITE_UUID: app.testSuiteUuid,
          VERSION_NUMBER: app.versionNumber,
        })) || [];

      const result = {
        message: "JSON Downloaded",
        data: {
          pageConfig,
          testsetConfig: { testsets },
          apiconfig: [],
          application,
        },
      };

      log("INFO", "JSON recomposition completed", {
        pageConfig: pageConfig.length,
        testsets: testsets.length,
        application: application.length,
      });

      return result;
    } catch (error) {
      log("ERROR", "JSON recomposition failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Group array by a key
   */
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group).push(item);
      return groups;
    }, new Map());
  }

  /**
   * Check if collections exist for a dataset
   */
  async hasCollections(datasetName) {
    const expectedCollections = [
      "pages",
      "page_elements",
      "testsets",
      "testcases",
      "steps",
      "application",
    ];

    for (const collectionName of expectedCollections) {
      try {
        const meta = await this.collectionStore.getCollectionMeta(
          collectionName
        );
        if (meta.count === 0) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }

    return true;
  }
}

// Export singleton instance
module.exports = new NormalizationService();
