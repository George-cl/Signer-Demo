

export async function createTransferDeploy(publicKeyHex) {

    let publicKey = PublicKey.fromHex(publicKeyHex);

    let sessionCode = DeployUtil.ExecutableDeployItem.newTransfer(
      200,
      publicKey,
      null,
      this.state.transferTag
    )

    return DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        publicKey,
        "Signer-Demo-Chain"
      ),
      sessionCode,
      DeployUtil.standardPayment(100000000000)
    );
  }

export async function createContractByPackageHashDeploy(publicKeyHex) {
    
    const publicKey = PublicKey.fromHex(publicKeyHex);
    const contractHash = decodeBase16('0116e3ba15cfbc4daafb2b43e2c26490015f7d6a1f575e69556251df3f7eb915');
    const deployParams = new DeployUtil.DeployParams(publicKey, 'casper');
    const args = RuntimeArgs.fromMap({
      action: CLValue.string("undelegate"),
      delegator: CLValue.publicKey(publicKey),
      validator: CLValue.publicKey(publicKey),
      amount: CLValue.u512(500)
    });
    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      contractHash,
      "undelegate",
      args
    )

    return DeployUtil.makeDeploy(
      deployParams,
      session,
      DeployUtil.standardPayment(100000000000)
    );
  }

export async function signDeploy() {
    let key = await Signer.getActivePublicKey()
        .catch(err => {
        alert(err);
        return;
        });
    if (!key) return;
    this.setState({activeKey: key});
    let deploy;
    switch (this.state.deployType) {
        case 'transfer' : 
        deploy = await this.createTransferDeploy(key);
        break;
        case 'stored' : 
        deploy = await this.createContractByPackageHashDeploy(key);
        break;
        default: 
        alert('Please select which type of deploy to sign first');
        return;
    }
    let deployJSON = DeployUtil.deployToJson(deploy);
    let signedDeployJSON;
    try {
        signedDeployJSON = await Signer.sign(deployJSON, key);
    } catch (err) {
        this.setState({currentNotification: 'cancelled-sign', showAlert: true});
        return;
    }
    let signedDeploy = DeployUtil.deployFromJson(signedDeployJSON);
    this.setState({
        signature: signedDeploy.approvals[0].signature,
        deployHash: encodeBase16(signedDeploy.hash),
        deploy: signedDeployJSON,
        deployProcessed: true
    });

    await this.casperService.deploy(signedDeploy);  
}