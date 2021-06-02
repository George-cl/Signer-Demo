import React from 'react';
import logo from './logo.png';
import './styles/App.css';
import {
  Button,
  TextField,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Modal,
  Fab
} from '@material-ui/core';
import CachedIcon from '@material-ui/icons/Cached';
import CloseIcon from '@material-ui/icons/Close';

import { 
  Signer,
  DeployUtil,
  PublicKey,
  CasperServiceByJsonRPC,
  encodeBase16,
} from 'casper-client-sdk';
export default class App extends React.Component {
  
  constructor() {
    super();
    this.state = {
      signerConnected: false,
      transferTag: "",
      contractWasm: null,
      deployHash: "",
      deploy: {},
      signingKey: "",
      signature: "",
      deployProcessed: false,
      modalOpen: false
    };
    this.casperService = new CasperServiceByJsonRPC('Signer-Demo-url')
  }

  componentDidMount() {
    Signer.getVersion().then((ver) => {
      console.log("VER", ver);
    });
    document.addEventListener("signerConnected", event => {
      alert(event.detail.name);
    });
  }

  handleChange(event) {
    this.setState({transferTag: event.target.value});
  }

  handleClose() {
    this.setState({modalOpen: false});
  }

  truncateString(
    longString,
    startChunk,
    endChunk
  ){
    return (
      longString.substring(0, startChunk) +
      '...' +
      longString.substring(longString.length - endChunk)
    );
  }

  async checkConnection() {
    return await Signer.isConnected();
  }

  async connectToSigner() {
    if (await this.checkConnection()) {
      alert("Already Connected!");
      return;
    }
    return Signer.sendConnectionRequest();
  }

  async createDummyDeploy(accountPublicKey) {

    let publicKey = PublicKey.fromHex(accountPublicKey);

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

  async signDeploy() {
    let key = await Signer.getActivePublicKey()
      .catch(err => {
        alert(err);
        return;
      });
    this.setState({signingKey: key});
    let deploy = await this.createDummyDeploy(key);
    let deployJSON = DeployUtil.deployToJson(deploy);
    console.log(deployJSON);
    let signedDeployJSON;
    try {
      signedDeployJSON = await Signer.sign(deployJSON, key);
    } catch (err) {
      if (err.message === 'User cancelled signing') {
        alert('User Cancelled Signing!');
        return;
      } else {
        alert(err);
        return;
      }
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

  showDeploy() {
    this.setState({modalOpen: true});
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <Typography
            variant="h2"
          >
            Signer Demonstration
          </Typography>
          <img src={logo} className="App-logo" alt="logo" />
          <Button
            size="large"
            variant="contained"
            color="primary"
            onClick={() => {this.connectToSigner()}}
            style={{margin: '1rem', width: '60%', backgroundColor: '#181d41'}}
            >
            Connect to Signer
          </Button>
          <TextField
            color="secondary"
            variant="filled"
            label="Enter a numeric tag for the dummy transfer..."
            value={this.state.transferTag}
            onSubmit={() => {this.signDeploy()}}
            onChange={evt => this.handleChange(evt)}
            style={{backgroundColor: 'white', borderRadius: '10px', width: '60%'}}
            />
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
                float: 'left'
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
                  margin: '.8rem'
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
                  <td>{ this.truncateString(this.state.signingKey, 8, 8) }</td>
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
                  >{ this.truncateString(this.state.signature, 8, 8) }</td>
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
                  >{ this.truncateString(this.state.deployHash, 8, 8) }</td>
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
