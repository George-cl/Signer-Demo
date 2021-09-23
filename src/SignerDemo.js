import React from 'react';

import logo from './img/logo.png';
// import banner from './img/top-banner-curve-w-dots.svg'
import './styles/App.css';
import {
  Button,
  TextField,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Modal,
  Fab,
  Select,
  MenuItem,
  FormControl,
  Snackbar
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import CachedIcon from '@material-ui/icons/Cached';
import CloseIcon from '@material-ui/icons/Close';

import { 
  Signer,
  DeployUtil,
  CLPublicKey,
  CasperServiceByJsonRPC,
  encodeBase16,
  decodeBase16,
  RuntimeArgs,
  CLString,
  CLU512,
  CLPublicKeyTag,
  CLU32,
  CLByteArray,
  CLBool,
  CLList,
  CLTuple3,
  verifyMessageSignature,
} from 'casper-js-sdk';

export default class SignerDemo extends React.Component {
  
  constructor() {
    super();
    this.state = {
      signerConnected: false,
      signerLocked: true,
      transferTag: "",
      message: "",
      contractWasm: null,
      deployHash: "",
      deploy: {},
      activeKey: "",
      signature: "",
      deployProcessed: false,
      modalOpen: false,
      deployType: "select",
      showAlert: false,
      currentNotification: {}
    };
    this.casperService = new CasperServiceByJsonRPC('Signer-Demo-url')
  }

  async componentDidMount() {
    // Without the timeout it doesn't always work properly
    setTimeout(async () => {
      try {
        const connected = await this.checkConnection();
        this.setState({ signerConnected: connected })
      } catch (err) {
        console.log(err)
        this.setState({currentNotification: {text: err.message}, showAlert: true});
      }
    }, 100);
    if (this.state.signerConnected) this.setState({activeKey: await this.getActiveKeyFromSigner()})
    window.addEventListener('signer:connected', msg => {
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        signerConnected: true,
        activeKey: msg.detail.activeKey,
        currentNotification: {text: 'Connected to Signer!', severity: 'success'},
        showAlert: true
      });
    });
    window.addEventListener('signer:disconnected', msg => {
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        signerConnected: false,
        activeKey: msg.detail.activeKey,
        currentNotification: {text: 'Disconnected from Signer', severity: 'info'},
        showAlert: true
      });
    });
    window.addEventListener('signer:tabUpdated', msg => {
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        signerConnected: msg.detail.isConnected,
        activeKey: msg.detail.activeKey
      })
    });
    window.addEventListener('signer:activeKeyChanged', msg => {
      this.setState({
        activeKey: msg.detail.activeKey,
        currentNotification: {text: 'Active key changed', severity: 'warning'},
        showAlert: true
      });
    });
    window.addEventListener('signer:locked', msg => {
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        currentNotification: {text: 'Signer has locked', severity: 'info'},
        showAlert: true,
        activeKey: msg.detail.activeKey
      })
    });
    window.addEventListener('signer:unlocked', msg => {
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        signerConnected: msg.detail.isConnected,
        activeKey: msg.detail.activeKey
      })
    });
    window.addEventListener('signer:initialState', msg => {
      console.log("Initial State: ", msg.detail);
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        signerConnected: msg.detail.isConnected,
        activeKey: msg.detail.activeKey
      });
    })
  }

  handleTransferIdChange(event) {
    this.setState({transferTag: event.target.value});
  }
  
  handleMessageChange(event) {
    this.setState({message: event.target.value});
  }

  handleClose() {
    this.setState({modalOpen: false});
  }

  toggleAlert(show) {
    this.setState({showAlert: show});
  }

  createAlert = (text, severity = 'error') => {
    return (
      <Alert onClose={() => this.toggleAlert(false)} severity={severity}>
        {text}{severity === 'error' ? '!' : ''}
      </Alert>
    );
  }

  truncateString(
    longString,
    startChunk,
    endChunk
  ){
    if (!longString) return;
    return (
      longString.substring(0, startChunk) +
      '...' +
      longString.substring(longString.length - endChunk)
    );
  }

  async checkConnection() {
    return await Signer.isConnected();
  }

  async getActiveKeyFromSigner() {
    return await Signer.getActivePublicKey();
  }

  async connectToSigner() {
    return Signer.sendConnectionRequest();
  }

  async createTransferDeploy(publicKeyHex) {

    let publicKey = CLPublicKey.fromHex(publicKeyHex);

    let sessionCode = DeployUtil.ExecutableDeployItem.newTransfer(
      2456300000,
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
      DeployUtil.standardPayment(10000000)
    );
  }

  async createStakingDeploy(publicKeyHex, stakingAction) {
    
    const publicKey = CLPublicKey.fromHex(publicKeyHex);
    const contractHash = decodeBase16('0116e3ba15cfbc4daafb2b43e2c26490015f7d6a1f575e69556251df3f7eb915');
    const deployParams = new DeployUtil.DeployParams(publicKey, 'casper');
    const args = RuntimeArgs.fromMap({
      action: new CLString(stakingAction),
      delegator: new CLPublicKey(publicKey.value(), publicKey.isEd25519() ? CLPublicKeyTag.ED25519 : publicKey.isSecp256K1() ? CLPublicKeyTag.SECP256K1 : undefined),
      validator: new CLPublicKey(publicKey.value(), publicKey.isEd25519() ? CLPublicKeyTag.ED25519 : publicKey.isSecp256K1() ? CLPublicKeyTag.SECP256K1 : undefined),
      amount: new CLU512(5456400000)
    });
    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      contractHash,
      "undelegate",
      args
    )

    return DeployUtil.makeDeploy(
      deployParams,
      session,
      DeployUtil.standardPayment(1000000)
    );
  }

  async createDeployWithArbitraryArgs(publicKeyHex, complexity) {

    const publicKey = CLPublicKey.fromHex(publicKeyHex);
    const contractHash = decodeBase16('0116e3ba15cfbc4daafb2b43e2c26490015f7d6a1f575e69556251df3f7eb915');
    const deployParams = new DeployUtil.DeployParams(publicKey, 'casper');
    let args = [];
    switch (complexity) {
      case 'simple' : {
        args =  RuntimeArgs.fromMap({
          String: new CLString('Juice'),
          PublicKey: new CLPublicKey(publicKey.value(), publicKey.isEd25519() ? CLPublicKeyTag.ED25519 : publicKey.isSecp256K1() ? CLPublicKeyTag.SECP256K1 : undefined),
          U32: new CLU32(1250),
          ByteArray: new CLByteArray(publicKey.toAccountHash()),
          Boolean: new CLBool(false)
        });
        break;
      }
      case 'complex' : {
        args =  RuntimeArgs.fromMap({
          List: new CLList([
            new CLString('ItemA'),
            new CLString('ItemB'),
            new CLString('ItemC')
          ]),
          Tuple3: new CLTuple3([
            new CLByteArray(publicKey.toAccountHash()),
            new CLBool(true),
            new CLU32(300)
          ])
        });
        break;
      }
      default : throw new Error('Invalid complexity provided');
    }

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      contractHash,
      "test-args",
      args
    )

    return DeployUtil.makeDeploy(
      deployParams,
      session,
      DeployUtil.standardPayment(1000000)
    );


  }

  async signDeploy() {
    let key;
    try {
      key = await Signer.getActivePublicKey();
    } catch (err) {
      this.setState({currentNotification: {text: err.message, severity: 'error'}, showAlert: true});
      return;
    }
    this.setState({activeKey: key});
    let deploy, deployJSON;
    switch (this.state.deployType) {
      case 'transfer' : 
        deploy = await this.createTransferDeploy(key);
        deployJSON = DeployUtil.deployToJson(deploy);
        break;
      case 'delegate' : 
        deploy = await this.createStakingDeploy(key, 'delegate');
        deployJSON = DeployUtil.deployToJson(deploy);
        break;
      case 'undelegate' :
        deploy = await this.createStakingDeploy(key, 'undelegate');
        deployJSON = DeployUtil.deployToJson(deploy);
        break;
      case 'arbExampleSimple' :
        deploy = await this.createDeployWithArbitraryArgs(key, 'simple');
        deployJSON = DeployUtil.deployToJson(deploy);
        break;
      case 'arbExampleComplex' :
        deploy = await this.createDeployWithArbitraryArgs(key, 'complex');
        deployJSON = DeployUtil.deployToJson(deploy);
        break;  
      case 'undefined' :
        // emulates sending sign request with no deploy parameter
        deployJSON = undefined;
        break;
      default: 
        this.setState({currentNotification: {text: 'Please select deploy type', severity: 'warning'}, showAlert: true});
        return;
    }
    let signedDeployJSON;
    try {
      signedDeployJSON = await Signer.sign(deployJSON, key, key);
    } catch (err) {
      this.setState({currentNotification: {text: err.message, severity: 'error'}, showAlert: true});
      return;
    }
    let signedDeploy = DeployUtil.deployFromJson(signedDeployJSON).unwrap();
    this.setState({
      signature: signedDeploy.approvals[0].signature,
      deployHash: encodeBase16(signedDeploy.hash),
      deploy: signedDeployJSON,
      deployProcessed: true,
      currentNotification: {text: 'Deploy Signed', severity: 'success'},
      showAlert: true
    });
    
    // await this.casperService.deploy(signedDeploy);  
  }

  signMessage = async () => {
    if (!this.state.message) {
      this.setState({currentNotification: {text: 'Please enter a message', severity: 'error'}});
      return;
    }
    const publicKeyHex = await this.getActiveKeyFromSigner();
    const signature = await Signer.signMessage(this.state.message, publicKeyHex);
    if (verifyMessageSignature(CLPublicKey.fromHex(publicKeyHex), this.state.message, decodeBase16(signature))) {
      this.setState({
        signature: signature,
        currentNotification: {text: 'Signature Verified', severity: 'success'},
        showAlert: true
      });
    } else {
      this.setState({
        currentNotification: {text: 'Signature Verification Failed', severity: 'error'},
        showAlert: true
      });
    }
  }

  showDeploy() {
    this.setState({modalOpen: true});
  }

  handleDeploySelect = (event => {
    const dType = event.target.value;
    this.setState({deployType: dType});
  });

  render() {
    return (
      <div className="App">
        <Snackbar
          id='error-bar'
          open={this.state.showAlert}
          autoHideDuration={6000}
          onClose={() => this.toggleAlert(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          {this.createAlert(this.state.currentNotification.text, this.state.currentNotification.severity)}
        </Snackbar>
        <header className="App-header">
          <Typography
            variant="h2"
          >
            Signer Demonstration
          </Typography>
          <img src={logo} className="App-logo" alt="logo" />
          { this.state.signerConnected ? this.state.signerLocked ?
            <Typography
              style={{
                background: 'indigo',
                width: '60%',
                borderRadius: '.6rem',
                marginBottom: '1rem',
                padding: '.5rem 0'
              }}
            >
              Unlock the Signer to get Started
            </Typography>
            :
            <Typography
              style={{
                background: 'indigo',
                width: '60%',
                borderRadius: '.6rem',
                marginBottom: '1rem',
                padding: '.5rem 0'
              }}
            >
              Connected with: { this.truncateString(this.state.activeKey, 10, 10) }
            </Typography>
          :         
            <Button
              size="large"
              variant="contained"
              color="primary"
              disabled={this.state.signerConnected}
              onClick={() => {this.connectToSigner()}}
              style={{margin: '1rem', width: '60%', backgroundColor: 'indigo', color: 'white'}}
              >
                Connect to Signer
            </Button>
          }
          <FormControl fullWidth
            style={{
              width: '60%'
            }}
          >
            <Select
              id='deploy-select'
              labelId='deploy-type-select-lbl'
              value={this.state.deployType}
              disableUnderline
              onChange={this.handleDeploySelect}
            >
              <MenuItem value="select" disabled>Select deploy type...</MenuItem>
              <MenuItem value={'transfer'}>Transfer</MenuItem>
              <MenuItem value={'delegate'}>Delegate</MenuItem>
              <MenuItem value={'undelegate'}>Undelegate</MenuItem>
              <MenuItem value={'arbExampleSimple'}>Arbitrary Example (Simple)</MenuItem>
              <MenuItem value={'arbExampleComplex'}>Arbitrary Example (Complex)</MenuItem>
              <MenuItem value={'undefined'}>Undefined Deploy</MenuItem>
              <MenuItem value={'message'}>Sign a message</MenuItem>
              {/* <MenuItem value={'session'}>Session</MenuItem> */}
            </Select>
          </FormControl>
          {(this.state.deployType === 'transfer' || this.state.deployType === 'message') &&
            <TextField
              color="secondary"
              variant="filled"
              label={this.state.deployType === 'transfer' ? "Enter a transferId (any valid u64 will do)..." : "Enter a message"}
              value={this.state.deployType === 'transfer' ? this.state.transferTag : this.state.message}
              onSubmit={() => this.state.deployType === 'transfer' ? this.signDeploy() : this.signMessage()}
              onChange={evt => this.state.deployType === 'transfer' ? this.handleTransferIdChange(evt) : this.handleMessageChange(evt)}
              style={{
                backgroundColor: 'white',
                borderRadius: '.6rem',
                width: '60%',
                marginTop: '.8em'
              }}
              />}
          <div 
            style={{
              width: '60%'
            }}
            >
            <Button
              size="large"
              variant="contained"
              color="secondary"
              onClick={() => {this.state.deployType === 'message' ? this.signMessage() : this.signDeploy()}}
              style={{
                margin: '1rem',
                marginLeft: 0,
                width: '80%',
                float: 'left',
                backgroundColor: 'purple'
              }}
              >
              Sign Deploy
            </Button>
            <Tooltip 
              arrow
              title="Clear"
              placement="right"
            >
              <IconButton
                size="medium"
                color="secondary"
                onClick={() => window.location.reload()}
                style={{
                  margin: '.8rem',
                  color: 'springgreen'
                }}
                >
                <CachedIcon />
              </IconButton>
            </Tooltip>
          </div>
          <Paper
            style={{
              color: 'grey',
              textAlign: 'left',
              fontSize: '1rem',
              padding: '.3rem',
              backgroundColor: 'white',
              width: '60%',
              borderRadius: '10px',
              wordWrap: 'break-word'
            }}
          >
            <table style={{
              tableLayout: 'fixed',
              width: '100%'}}
            >
              <tbody>
                <tr>
                  <th style={{
                      width: '30%'
                    }}                  
                    >
                      <b style={{
                        fontSize: '1.2rem',
                        whiteSpace: 'nowrap'}}
                      >
                        Signing Key:
                      </b>
                    </th>
                  <td>{ this.state.activeKey ? this.truncateString(this.state.activeKey, 8, 8) : '' }</td>
                </tr>
                <tr>
                  <th style={{
                      width: '30%'
                    }}                  
                    >
                      <b style={{
                        fontSize: '1.2rem',
                        whiteSpace: 'nowrap'}}
                      >
                        Signature:
                      </b>
                    </th>
                  <td
                    style={{
                      paddingTop: '1rem'
                    }}                  
                  >{ this.state.signature ? this.truncateString(this.state.signature, 8, 8) : '' }</td>
                </tr>
                <tr>
                  <th style={{
                    width: '30%'
                  }}                  
                  >
                    <b style={{
                      fontSize: '1.2rem',
                      whiteSpace: 'nowrap'}}
                    >
                      Deploy Hash:
                    </b>
                  </th>
                  <td
                    style={{
                      paddingTop: '1rem'
                    }}
                  >{ this.state.deployHash ? this.truncateString(this.state.deployHash, 8, 8) : '' }</td>
                </tr>
              </tbody>
            </table>            
          </Paper>
          <Button
              disabled={!this.state.deployProcessed}
              id={this.state.deployProcessed ? "show-deploy-btn" : null}
              size="large"
              variant="contained"
              color="primary"
              onClick={() => {this.showDeploy()}}
              style={{margin: '1rem', width: '60%'}}
            >
            View full deploy
          </Button>
          <Modal
            open={this.state.modalOpen}
            onClose={() => {this.handleClose()}}
            style={{
              background: 'rgba(0,0,0,0.8)',
              color: 'whitesmoke',
              fontSize: '1.1rem',
              overflowY: 'scroll',
              outline: 0
            }}
          >
            <pre>
                <Fab size='small' color='secondary'
                  onClick={() => {this.handleClose()}}
                  style={{
                    top: '1rem',
                    right: '2rem',
                    position: 'fixed'
                  }}
                >
                  <CloseIcon />
                </Fab>
                { JSON.stringify(this.state.deploy, null, 2) }
              </pre> 
          </Modal>
        </header>
      </div>
    );
  }
}
