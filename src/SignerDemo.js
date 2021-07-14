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
  CLPublicKeyTag
} from 'casper-js-sdk';

export default class SignerDemo extends React.Component {
  
  constructor() {
    super();
    this.state = {
      signerConnected: false,
      signerLocked: true,
      transferTag: "",
      contractWasm: null,
      deployHash: "",
      deploy: {},
      activeKey: "",
      signature: "",
      deployProcessed: false,
      modalOpen: false,
      deployType: "select",
      showAlert: false,
      currentNotification: ""
    };
    this.casperService = new CasperServiceByJsonRPC('Signer-Demo-url')
  }

  async componentDidMount() {
    // Without the timeout it doesn't always work properly
    setTimeout(async () => this.setState({signerConnected: await this.checkConnection()}), 0.05);
    if (this.state.signerConnected) this.setState({activeKey: await this.getActiveKeyFromSigner()})
    window.addEventListener('signer:connected', msg => {
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        signerConnected: true,
        activeKey: msg.detail.activeKey,
        currentNotification: 'connected',
        showAlert: true
      });
    });
    window.addEventListener('signer:disconnected', msg => {
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        signerConnected: false,
        activeKey: msg.detail.activeKey,
        currentNotification: 'disconnected',
        showAlert: true
      });
    });
    window.addEventListener('signer:tabUpdated', msg => {
      console.log('signer :: tabUpdated: ', msg.detail);
    });
    window.addEventListener('signer:activeKeyChanged', msg => {
      this.setState({
        activeKey: msg.detail.activeKey,
        currentNotification: 'key-change',
        showAlert: true
      });
    });
    window.addEventListener('signer:locked', msg => {
      this.setState({
        signerLocked: !msg.detail.isUnlocked,
        currentNotification: 'locked',
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
  }

  handleChange(event) {
    this.setState({transferTag: event.target.value});
  }

  handleClose() {
    this.setState({modalOpen: false});
  }

  toggleAlert(show) {
    this.setState({showAlert: show});
  }

  createAlert = (reason) => {
    switch (reason) {
      case 'connected': {
        return (
          <Alert onClose={() => this.toggleAlert(false)} severity="success">
            Connected to Signer!
          </Alert>
        );
      }
      case 'disconnected': {
        return (
          <Alert onClose={() => this.toggleAlert(false)} severity="info">
            Disconnected from Signer
          </Alert>
        );
      }
      case 'locked': {
        return (
          <Alert onClose={() => this.toggleAlert(false)} severity="info">
            Signer has locked
          </Alert>
        );
      }
      case 'User Cancelled Signing': {
        return (
          <Alert onClose={() => this.toggleAlert(false)} severity="error">
            User cancelled signing!
          </Alert>
        );
      }
      case 'key-change': {
        return (
          <Alert onClose={() => this.toggleAlert(false)} severity="warning">
            Active key changed
          </Alert>
        );   
      }
      default: {
        return (
          <Alert onClose={() => this.toggleAlert(false)} severity='error'>
            {reason}
          </Alert>
        )
      }
    }
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

  async createContractByPackageHashDeploy(publicKeyHex) {
    
    const publicKey = CLPublicKey.fromHex(publicKeyHex);
    const contractHash = decodeBase16('0116e3ba15cfbc4daafb2b43e2c26490015f7d6a1f575e69556251df3f7eb915');
    const deployParams = new DeployUtil.DeployParams(publicKey, 'casper');
    const args = RuntimeArgs.fromMap({
      action: new CLString("undelegate"),
      delegator: new CLPublicKey(publicKey.value(), publicKey.isEd25519() ? CLPublicKeyTag.ED25519 : publicKey.isSecp256K1() ? CLPublicKeyTag.SECP256K1 : undefined),
      validator: new CLPublicKey(publicKey.value(), publicKey.isEd25519() ? CLPublicKeyTag.ED25519 : publicKey.isSecp256K1() ? CLPublicKeyTag.SECP256K1 : undefined),
      amount: new CLU512(500)
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

  async signDeploy() {
    let key;
    try {
      key = await Signer.getActivePublicKey();
    } catch (err) {
      this.setState({currentNotification: err.message, showAlert: true});
      return;
    }
    this.setState({activeKey: key});
    let deploy, deployJSON;
    switch (this.state.deployType) {
      case 'transfer' : 
        deploy = await this.createTransferDeploy(key);
        deployJSON = DeployUtil.deployToJson(deploy);
        break;
      case 'stored' : 
        deploy = await this.createContractByPackageHashDeploy(key);
        deployJSON = DeployUtil.deployToJson(deploy);
        break;
      case 'bad' :
        // emulates missing deploy arg
        deployJSON = undefined;
        break;
      default: 
        alert('Please select which type of deploy to sign first');
        return;
    }
    let signedDeployJSON;
    try {
      signedDeployJSON = await Signer.sign(deployJSON, key, key);
    } catch (err) {
      this.setState({currentNotification: err.message, showAlert: true});
      return;
    }
    let signedDeploy = DeployUtil.deployFromJson(signedDeployJSON).unwrap();
    this.setState({
      signature: signedDeploy.approvals[0].signature,
      deployHash: encodeBase16(signedDeploy.hash),
      deploy: signedDeployJSON,
      deployProcessed: true
    });

    await this.casperService.deploy(signedDeploy);  
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
          autoHideDuration={8000}
          onClose={() => this.toggleAlert(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          {this.createAlert(this.state.currentNotification)}
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
              <MenuItem value={'stored'}>Call a Stored Contract</MenuItem>
              <MenuItem value={'bad'}>Bad Deploy</MenuItem>
              {/* <MenuItem value={'session'}>Session</MenuItem> */}
            </Select>
          </FormControl>
          {this.state.deployType === 'transfer' &&
            <TextField
              color="secondary"
              variant="filled"
              label="Enter a transferId (any valid u64 will do)..."
              value={this.state.transferTag}
              onSubmit={() => {this.signDeploy()}}
              onChange={evt => this.handleChange(evt)}
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
              onClick={() => {this.signDeploy()}}
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
