const { hdb_status } = tables;
const DEFAULT_200_MSG = "Status endpoint is reporting for duty.";
const DEFAULT_404_MSG = "Status endpoint is reporting downtime.";

if (server.workerIndex == 0) {
  (async () => {
    let record = await hdb_status.get(1);
    if (!record) {
      await hdb_status.put({ id: 1, status: 200, message: DEFAULT_200_MSG });
    }
  })();
}

export class status extends Resource {
  allowRead() {
    return true;
  }
  async get() {
    let record = await hdb_status.get(1);
    if (!record?.status) {
      //returning undefined will cause Harper to return status of 404
      return;
    }

    if (record.status === 200) {
      return record.message ? record.message : DEFAULT_200_MSG;
    } else {
      let err = new Error(record.message ? record.message : DEFAULT_404_MSG);
      err.statusCode = record.status;
      throw err;
    }
  }

  async post() {
    await hdb_status.put({ id: 1, status: 200, message: DEFAULT_200_MSG });
  }

  async delete() {
    await hdb_status.put({ id: 1, status: 404, message: DEFAULT_404_MSG });
  }
}
